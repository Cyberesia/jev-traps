import { appendFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { NextResponse } from "next/server";
import { readBoundedJson, validateSubmission } from "../../../lib/submissions";
export const runtime = "nodejs";
export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production" && process.env.REGISTRY_ENABLE_SUBMISSIONS !== "1") return NextResponse.json({ error: "This deployment is read-only. Contribute a redacted synthetic fixture through GitHub." }, { status: 503 });
  let input: ReturnType<typeof validateSubmission>;
  try { input = validateSubmission(await readBoundedJson(request)); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid report." }, { status: 400 }); }
  const row = { id: crypto.randomUUID(), ...input, submittedAt: new Date().toISOString(), status: "pending_review" };
  const file = process.env.REGISTRY_DATA_FILE ? resolve(process.env.REGISTRY_DATA_FILE) : resolve(process.cwd(), "data/submissions.local.json");
  try { await mkdir(dirname(file), { recursive: true }); await appendFile(file, `${JSON.stringify(row)}\n`, { encoding: "utf8", mode: 0o600 }); }
  catch { return NextResponse.json({ error: "The review queue is unavailable. Your report was not saved. Please try again later." }, { status: 503 }); }
  return NextResponse.json({ message: "Saved to the private review queue. No scan was run and nothing was published.", id: row.id, status: row.status }, { status: 202 });
}
