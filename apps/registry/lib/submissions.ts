import { isIP } from "node:net";

/** Intake validation only. This is NOT an SSRF boundary for a URL fetcher. */
export function validateSubmission(body: unknown): { url: string; note: string } {
  if (!body || typeof body !== "object") throw new Error("A public URL is required.");
  const { url: raw, note } = body as Record<string, unknown>;
  if (typeof raw !== "string" || raw.length > 2048) throw new Error("Provide a URL of at most 2048 characters.");
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error("Invalid URL."); }
  const host = url.hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "").toLowerCase();
  if (!["http:", "https:"].includes(url.protocol) || isIP(host) || !host.includes(".") || /(?:^|\.)(?:localhost|local|internal|test|invalid|example)$/.test(host) || (url.port && !["80", "443"].includes(url.port))) throw new Error("Use a public HTTP(S) domain, not an IP, internal hostname or nonstandard port.");
  // URLs are public evidence: exclude all queries/fragments instead of guessing secret parameter names.
  if (url.username || url.password || url.search || url.hash) throw new Error("Remove credentials, query parameters and fragments before submitting.");
  if (note !== undefined && (typeof note !== "string" || note.length > 1500)) throw new Error("The note must be at most 1500 characters.");
  return { url: url.toString(), note: typeof note === "string" ? note.trim() : "" };
}

export async function readBoundedJson(request: Request, limit = 8192): Promise<unknown> {
  if (!request.headers.get("content-type")?.includes("application/json")) throw new Error("Send application/json.");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Missing body.");
  let size = 0; const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); throw new Error("Report is too large."); }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } finally { reader.releaseLock(); }
}
