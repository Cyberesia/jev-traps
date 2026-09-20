import { NextResponse } from "next/server";
import { getIntakeStore, type SubmissionRow } from "../../../lib/intake";
import { readBoundedJson, validateSubmission } from "../../../lib/submissions";
import { verifyTurnstile } from "../../../lib/turnstile";

export const runtime = "nodejs";

const DEFAULT_DAILY_CAP = 200;

const json = (body: Record<string, unknown>, status: number) => NextResponse.json(body, { status });

/**
 * Browser submissions must come from this deployment. Non-browser clients
 * without an Origin header (CLI, curl) are not restricted by this check.
 */
function isAllowedOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return false;
  }
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? new URL(request.url).host;
  return originHost === host;
}

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production" && process.env.REGISTRY_ENABLE_SUBMISSIONS !== "1") {
    return json(
      { error: "This deployment is read-only. Contribute a redacted synthetic fixture through GitHub." },
      503,
    );
  }

  if (process.env.NODE_ENV === "production" && (!process.env.DATABASE_URL || !process.env.TURNSTILE_SECRET_KEY || !process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY)) {
    return json({ error: "The private intake is not configured. Your report was not saved." }, 503);
  }
  let body: unknown;
  try {
    body = await readBoundedJson(request);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Invalid report." }, 400);
  }

  // A discarded request must never receive a persistence receipt.
  const honeypot = (body as Record<string, unknown> | null)?.website;
  if (typeof honeypot === "string" && honeypot.trim()) return json({ error: "The anti-abuse check failed." }, 403);

  let input: ReturnType<typeof validateSubmission>;
  try {
    input = validateSubmission(body);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Invalid report." }, 400);
  }

  if (!isAllowedOrigin(request)) {
    return json({ error: "This report did not come from the registry site." }, 403);
  }

  const turnstile = await verifyTurnstile((body as Record<string, unknown>).turnstileToken, request);
  if (!turnstile.ok) {
    return json({ error: "The anti-abuse check failed. Reload the page and try again." }, 403);
  }

  const store = getIntakeStore();
  if (!store) {
    return json({ error: "The review queue is unavailable. Your report was not saved. Please try again later." }, 503);
  }

  const cap = Number.parseInt(process.env.REGISTRY_DAILY_CAP ?? "", 10);
  const dailyCap = Number.isFinite(cap) && cap > 0 ? cap : DEFAULT_DAILY_CAP;

  const row: SubmissionRow = {
    id: crypto.randomUUID(),
    ...input,
    status: "pending_review",
    submittedAt: new Date().toISOString(),
  };

  try {
    const result = await store.insert(row, { dailyCap, since: new Date(Date.now() - 24 * 60 * 60 * 1000) });
    if (!result.ok && "limited" in result) return json({ error: "The review queue is full for today. Please try again tomorrow." }, 429);
    if (!result.ok) {
      return json({ error: "This URL is already waiting for review. Nothing was duplicated." }, 409);
    }
  } catch {
    return json({ error: "The review queue is unavailable. Your report was not saved. Please try again later." }, 503);
  }

  return json(
    { message: "Saved to the private review queue. No scan was run and nothing was published.", id: row.id, status: row.status },
    202,
  );
}
