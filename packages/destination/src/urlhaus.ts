import { createHash, randomUUID } from "node:crypto";
import { open, mkdir, rename, unlink, readFile, stat } from "node:fs/promises";
import { dirname } from "node:path";
import { Readable } from "node:stream";
import { parse } from "csv-parse";
import { canonicalizeDestination } from "./canonical.js";
import { validateSnapshot } from "./snapshot.js";
import type { DestinationRecord, DestinationSnapshot } from "./types.js";

export interface UrlhausRefreshOptions {
  authKey: string;
  cachePath: string;
  endpoint?: string;
  fetch?: typeof globalThis.fetch;
  now?: Date;
  maxBytes?: number;
  maxRecords?: number;
  minRecords?: number;
  timeoutMs?: number;
}

const DEFAULT_ENDPOINT = "https://urlhaus-api.abuse.ch/v2/files/exports/{authKey}/online.csv";

async function parseActiveCsv(
  body: ReadableStream<Uint8Array>,
  limits: { maxBytes: number; maxRecords: number },
): Promise<DestinationRecord[]> {
  let bytes = 0;
  async function* limited() {
    for await (const chunk of body) {
      bytes += chunk.byteLength;
      if (bytes > limits.maxBytes) throw new Error("URLhaus export exceeds byte limit");
      yield Buffer.from(chunk);
    }
  }
  const parser = Readable.from(limited()).pipe(parse({
    bom: true,
    columns: (header: string[]) => header.map((name) => name.trim().replace(/^#\s*/, "").toLowerCase()),
    comment: "#",
    skip_empty_lines: true,
    relax_column_count: false,
    max_record_size: 65_536,
    trim: true,
  }));
  const records: DestinationRecord[] = [];
  let invalid = 0;
  for await (const row of parser as AsyncIterable<Record<string, string>>) {
    const raw = row.url;
    if (!raw || raw.length > 8_192) {
      invalid++;
      continue;
    }
    try {
      const canonical = canonicalizeDestination(raw);
      records.push({
        canonicalUrl: canonical.url,
        hostname: canonical.hostname,
        status: row.url_status === "offline" ? "offline" : row.url_status === "online" ? "online" : "unknown",
        dateAdded: validDate(row.dateadded),
        lastOnline: validDate(row.last_online),
        threat: bounded(row.threat, 120),
      });
    } catch {
      invalid++;
    }
    if (records.length > limits.maxRecords) throw new Error("URLhaus export exceeds record limit");
  }
  if (invalid > Math.max(50, records.length * 0.02)) throw new Error("URLhaus export contains too many invalid records");
  return records;
}

function validDate(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const date = new Date(value.endsWith("Z") ? value : `${value.replace(" ", "T")}Z`);
  return Number.isFinite(date.getTime()) ? date.toISOString() : undefined;
}

function bounded(value: string | undefined, max: number): string | undefined {
  return value && value.length <= max && !/[\u0000-\u001f\u007f]/.test(value) ? value : undefined;
}

function digest(records: DestinationRecord[]): string {
  return createHash("sha256").update(JSON.stringify(records)).digest("hex");
}

async function acquireLock(path: string) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await open(path, "wx", 0o600);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      const info = await stat(path).catch((statError: NodeJS.ErrnoException) => {
        if (statError.code === "ENOENT") return undefined;
        throw statError;
      });
      if (!info) continue;
      if (Date.now() - info.mtimeMs <= 5 * 60_000) throw new Error("Destination feed refresh already in progress");
      await unlink(path).catch((unlinkError: NodeJS.ErrnoException) => {
        if (unlinkError.code !== "ENOENT") throw unlinkError;
      });
    }
  }
  throw new Error("Unable to acquire destination feed refresh lock");
}

export async function refreshUrlhausSnapshot(options: UrlhausRefreshOptions): Promise<DestinationSnapshot> {
  if (!/^[A-Za-z0-9_-]{16,512}$/.test(options.authKey)) throw new Error("Invalid URLhaus Auth-Key");
  const now = options.now ?? new Date();
  const endpoint = (options.endpoint ?? DEFAULT_ENDPOINT).replace("{authKey}", encodeURIComponent(options.authKey));
  const url = new URL(endpoint);
  if (url.protocol !== "https:" || url.username || url.password || url.hash) throw new Error("Invalid URLhaus export endpoint");
  const directory = dirname(options.cachePath);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const lockPath = `${options.cachePath}.lock`;
  const lock = await acquireLock(lockPath);
  const tempPath = `${options.cachePath}.${randomUUID()}.tmp`;
  try {
    const response = await (options.fetch ?? globalThis.fetch)(url, {
      redirect: "error",
      signal: AbortSignal.timeout(options.timeoutMs ?? 30_000),
      headers: { Accept: "text/csv" },
    });
    if (!response.ok || !response.body) throw new Error(`URLhaus export failed with status ${response.status}`);
    const type = response.headers.get("content-type")?.toLowerCase() ?? "";
    if (type && !type.includes("csv") && !type.includes("text/plain") && !type.includes("octet-stream")) {
      throw new Error("URLhaus export returned an unexpected content type");
    }
    const records = await parseActiveCsv(response.body, {
      maxBytes: options.maxBytes ?? 128 * 1024 * 1024,
      maxRecords: options.maxRecords ?? 2_000_000,
    });
    if (records.length < (options.minRecords ?? 100)) throw new Error("URLhaus export is unexpectedly small");
    const providerDate = response.headers.get("last-modified");
    const hasProviderDate = Boolean(providerDate && Number.isFinite(Date.parse(providerDate)));
    const generated = hasProviderDate ? new Date(providerDate!) : now;
    if (generated.getTime() > now.getTime() + 5 * 60_000) throw new Error("URLhaus export timestamp is in the future");

    try {
      const previous = validateSnapshot(JSON.parse(await readFile(options.cachePath, "utf8")));
      if (Date.parse(previous.metadata.generatedAt) > generated.getTime()) throw new Error("URLhaus export timestamp rolled back");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT" && error instanceof Error && error.message.includes("rolled back")) throw error;
    }

    const snapshot: DestinationSnapshot = {
      metadata: {
        schemaVersion: 1,
        source: "urlhaus",
        generatedAt: generated.toISOString(),
        fetchedAt: now.toISOString(),
        timestampSource: hasProviderDate ? "provider" : "retrieval",
        recordCount: records.length,
        sha256: digest(records),
      },
      records,
    };
    const handle = await open(tempPath, "wx", 0o600);
    try {
      await handle.writeFile(`${JSON.stringify(snapshot)}\n`, "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }
    await rename(tempPath, options.cachePath);
    const directoryHandle = await open(directory, "r");
    try { await directoryHandle.sync(); } finally { await directoryHandle.close(); }
    return snapshot;
  } finally {
    await unlink(tempPath).catch(() => {});
    await lock.close();
    await unlink(lockPath).catch(() => {});
  }
}
