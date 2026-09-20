import registry from "../../../data/registry.json";
import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getObservationStore, trapTypes, type AutomatedObservationInput } from "../../../lib/observations";
import { readBoundedJson, validateSubmission } from "../../../lib/submissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const actions = new Set(["sanitize", "review", "block"]);
const surfaces = new Set(["text", "html", "image"]);
const allowedTrapTypes = new Set<string>(trapTypes);

const json = (body: Record<string, unknown>, status = 200) => NextResponse.json(body, { status });

function authorized(request: Request): boolean {
  const expected = process.env.REGISTRY_INGEST_KEY;
  const header = request.headers.get("authorization");
  if (!expected || !header?.startsWith("Bearer ")) return false;
  const actualHash = createHash("sha256").update(header.slice(7)).digest();
  const expectedHash = createHash("sha256").update(expected).digest();
  return timingSafeEqual(actualHash, expectedHash);
}

function validateObservation(body: unknown): AutomatedObservationInput {
  if (!body || typeof body !== "object") throw new Error("Invalid observation.");
  const record = body as Record<string, unknown>;
  if (record.schemaVersion !== 1) throw new Error("Unsupported observation schema.");

  const { url } = validateSubmission({ url: record.url });
  const parsed = new URL(url);
  if (record.action === "allow" || typeof record.action !== "string" || !actions.has(record.action)) {
    throw new Error("Only non-allow observations can be published.");
  }
  if (typeof record.risk !== "number" || !Number.isFinite(record.risk) || record.risk < 0 || record.risk > 1) {
    throw new Error("Risk must be between 0 and 1.");
  }
  if (
    !Array.isArray(record.trapTypes) ||
    record.trapTypes.length < 1 ||
    record.trapTypes.length > 12 ||
    record.trapTypes.some((type) => typeof type !== "string" || !allowedTrapTypes.has(type))
  ) {
    throw new Error("Invalid trap types.");
  }
  if (typeof record.detectorVersion !== "string" || !record.detectorVersion || record.detectorVersion.length > 120) {
    throw new Error("Invalid detector version.");
  }
  if (typeof record.surface !== "string" || !surfaces.has(record.surface)) throw new Error("Invalid surface.");
  if (typeof record.observedAt !== "string") throw new Error("Invalid observation timestamp.");
  const observedAt = new Date(record.observedAt);
  const now = Date.now();
  if (
    Number.isNaN(observedAt.getTime()) ||
    observedAt.getTime() < now - 30 * 24 * 60 * 60 * 1000 ||
    observedAt.getTime() > now + 5 * 60 * 1000
  ) {
    throw new Error("Observation timestamp is outside the accepted window.");
  }

  return {
    url,
    domain: parsed.hostname.toLowerCase(),
    action: record.action as AutomatedObservationInput["action"],
    risk: record.risk,
    trapTypes: [...new Set(record.trapTypes as string[])],
    detectorVersion: record.detectorVersion,
    observedAt: observedAt.toISOString(),
    surface: record.surface as AutomatedObservationInput["surface"],
  };
}

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production" && process.env.REGISTRY_ENABLE_OBSERVATIONS !== "1") {
    return json({ error: "Automated observation ingestion is disabled." }, 503);
  }
  if (!authorized(request)) return json({ error: "Invalid ingestion credentials." }, 401);

  let input: AutomatedObservationInput;
  try {
    input = validateObservation(await readBoundedJson(request, 16_384));
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Invalid observation." }, 400);
  }

  const store = getObservationStore();
  if (!store) return json({ error: "The observation registry is unavailable." }, 503);
  try {
    const observation = await store.upsert(input);
    return json(
      { id: observation.id, observations: observation.observations, status: observation.status },
      202,
    );
  } catch {
    return json({ error: "The observation registry is unavailable." }, 503);
  }
}

export async function GET() {
  // Only PR-reviewed public records are eligible. Never read the private inbox.
  const observations = registry.filter(entry => !entry.synthetic).map(entry => ({
    id: entry.id, domain: entry.domain, classification: entry.classification,
    status: entry.status, lastVerified: entry.lastVerified,
  })).sort((a, b) => b.lastVerified.localeCompare(a.lastVerified)).slice(0, 50);
  return NextResponse.json({ observations, count: observations.length, publicFeedEnabled: true },
    { headers: { "Cache-Control": "no-store" } });
}
