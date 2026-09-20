import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { canonicalizeDestination } from "./canonical.js";
import { evaluateSnapshot } from "./policy.js";
import type {
  DestinationIntelligenceProvider,
  DestinationPolicy,
  DestinationPreflight,
  DestinationRecord,
  DestinationSnapshot,
} from "./types.js";

const MAX_RECORDS = 2_000_000;

export function validateSnapshot(value: unknown): DestinationSnapshot {
  if (!value || typeof value !== "object") throw new Error("Invalid destination snapshot");
  const snapshot = value as DestinationSnapshot;
  const meta = snapshot.metadata;
  if (!meta || meta.schemaVersion !== 1 || typeof meta.source !== "string" || meta.source.length === 0 || meta.source.length > 64 ||
    !Number.isFinite(Date.parse(meta.generatedAt)) || !Number.isFinite(Date.parse(meta.fetchedAt)) ||
    !["provider", "retrieval"].includes(meta.timestampSource) ||
    !Number.isInteger(meta.recordCount) || meta.recordCount < 0 ||
    typeof meta.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(meta.sha256) ||
    !Array.isArray(snapshot.records) || snapshot.records.length !== meta.recordCount ||
    snapshot.records.length > MAX_RECORDS) {
    throw new Error("Invalid destination snapshot metadata");
  }
  for (const record of snapshot.records) {
    if (!record || !["online", "offline", "unknown"].includes(record.status)) throw new Error("Invalid destination record");
    if (record.threat && (record.threat.length > 120 || /[\u0000-\u001f\u007f]/.test(record.threat))) throw new Error("Invalid destination threat label");
    const canonical = canonicalizeDestination(record.canonicalUrl);
    if (canonical.url !== record.canonicalUrl || canonical.hostname !== record.hostname) throw new Error("Non-canonical destination record");
  }
  const digest = createHash("sha256").update(JSON.stringify(snapshot.records)).digest("hex");
  if (digest !== meta.sha256) throw new Error("Destination snapshot digest mismatch");
  return snapshot;
}

export async function loadSnapshot(path: string): Promise<DestinationSnapshot> {
  const bytes = await readFile(path);
  if (bytes.byteLength > 256 * 1024 * 1024) throw new Error("Destination snapshot exceeds size limit");
  return validateSnapshot(JSON.parse(bytes.toString("utf8")));
}

export class SnapshotProvider implements DestinationIntelligenceProvider {
  readonly snapshot: DestinationSnapshot;
  readonly policy: DestinationPolicy;
  readonly #urls = new Map<string, DestinationRecord>();
  readonly #hosts = new Map<string, DestinationRecord>();

  constructor(snapshot: DestinationSnapshot, policy: DestinationPolicy = {}) {
    this.snapshot = validateSnapshot(snapshot);
    this.policy = policy;
    for (const record of snapshot.records) {
      this.#urls.set(record.canonicalUrl, record);
      if (!this.#hosts.has(record.hostname)) this.#hosts.set(record.hostname, record);
    }
  }

  lookup(input: string, now = new Date()): DestinationPreflight {
    const canonical = canonicalizeDestination(input);
    const record = this.#urls.get(canonical.url) ?? this.#hosts.get(canonical.hostname);
    const subset = record ? { ...this.snapshot, records: [record], metadata: { ...this.snapshot.metadata, recordCount: 1 } } : this.snapshot;
    return evaluateSnapshot(input, subset, { now, policy: this.policy });
  }
}
