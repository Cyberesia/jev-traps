import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type postgres from "postgres";
import { getDatabase } from "./db";

export type SubmissionStatus = "pending_review" | "accepted" | "rejected" | "duplicate";

export type SubmissionRow = {
  id: string;
  url: string;
  note: string;
  status: SubmissionStatus;
  submittedAt: string;
};

export type InsertResult = { ok: true; id: string } | { ok: false; duplicate: true } | { ok: false; limited: true };
export type IntakeLimit = { dailyCap: number; since: Date };

/**
 * Private review queue. Stores minimal intake metadata only: a normalized
 * public URL, a neutral note and moderation state. Never persist raw HTML,
 * attachments, credentials, IP addresses or scan output.
 */
export interface IntakeStore {
  insert(row: SubmissionRow, limit?: IntakeLimit): Promise<InsertResult>;
  /** Reports received since the given instant, for the daily intake cap. */
  countSince(since: Date): Promise<number>;
}

const isUniqueViolation = (error: unknown): boolean => {
  if (!error || typeof error !== "object") return false;
  const { code, message } = error as { code?: unknown; message?: unknown };
  return code === "23505" || (typeof message === "string" && message.includes("duplicate key"));
};

class PostgresIntakeStore implements IntakeStore {
  constructor(private readonly sql: postgres.Sql) {}

  async insert(row: SubmissionRow, limit?: IntakeLimit): Promise<InsertResult> {
    try {
      return await this.sql.begin(async (transaction) => {
        // Serialize cap check + insert across replicas; never check the cap outside this transaction.
        await transaction`select pg_advisory_xact_lock(72934101)`;
        if (limit) {
          const counts = await transaction`select count(*)::int as count from submissions where submitted_at >= ${limit.since.toISOString()}`;
          if (Number(counts[0]?.count ?? 0) >= limit.dailyCap) return { ok: false, limited: true } as const;
        }
        await transaction`insert into submissions (id, url, note, status, submitted_at) values (${row.id}, ${row.url}, ${row.note}, ${row.status}, ${row.submittedAt})`;
        return { ok: true, id: row.id } as const;
      }) as InsertResult;
    } catch (error) {
      if (isUniqueViolation(error)) return { ok: false, duplicate: true };
      throw error;
    }
  }

  async countSince(since: Date): Promise<number> {
    const rows = await this.sql<{ count: number }[]>`
      select count(*)::int as count from submissions where submitted_at >= ${since.toISOString()}
    `;
    return rows[0]?.count ?? 0;
  }
}

/**
 * Local development fallback. JSONL on disk is only suitable for a
 * single-host installation; production deployments must use DATABASE_URL.
 */
const fileLocks = new Map<string, Promise<unknown>>();

class FileIntakeStore implements IntakeStore {
  constructor(private readonly file: string) {}

  private async readAll(): Promise<SubmissionRow[]> {
    let raw: string;
    try {
      raw = await readFile(this.file, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
    return raw
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line) as SubmissionRow);
  }

  async insert(row: SubmissionRow, limit?: IntakeLimit): Promise<InsertResult> {
    const previous = fileLocks.get(this.file) ?? Promise.resolve();
    const pending = previous.catch(() => undefined).then(async (): Promise<InsertResult> => {
      const existing = await this.readAll();
      if (existing.some(entry => entry.url === row.url && entry.status === "pending_review")) return { ok: false, duplicate: true };
      if (limit && existing.filter(entry => new Date(entry.submittedAt) >= limit.since).length >= limit.dailyCap) return { ok: false, limited: true };
      await mkdir(dirname(this.file), { recursive: true });
      await appendFile(this.file, `${JSON.stringify(row)}\n`, { encoding: "utf8", mode: 0o600 });
      return { ok: true, id: row.id };
    });
    fileLocks.set(this.file, pending);
    try { return await pending; } finally { if (fileLocks.get(this.file) === pending) fileLocks.delete(this.file); }
  }

  async countSince(since: Date): Promise<number> {
    const rows = await this.readAll();
    return rows.filter((entry) => new Date(entry.submittedAt) >= since).length;
  }
}

let testOverride: IntakeStore | null = null;

/** Test hook: inject a fake store. Pass null to restore env-based resolution. */
export function setIntakeStoreForTests(store: IntakeStore | null): void {
  testOverride = store;
}

/**
 * Resolve the intake store from the environment.
 * - DATABASE_URL        -> Postgres (Neon or any standard Postgres).
 * - REGISTRY_DATA_FILE  -> local JSONL file (development only).
 * - neither             -> null, intake unavailable (caller answers 503).
 */
export function getIntakeStore(env: NodeJS.ProcessEnv = process.env): IntakeStore | null {
  if (testOverride) return testOverride;
  if (env.DATABASE_URL) {
    return new PostgresIntakeStore(getDatabase(env.DATABASE_URL));
  }
  if (env.REGISTRY_DATA_FILE && env.NODE_ENV !== "production") {
    return new FileIntakeStore(resolve(env.REGISTRY_DATA_FILE));
  }
  return null;
}
