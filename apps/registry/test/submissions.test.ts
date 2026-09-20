import { describe, it, expect, vi, afterEach } from "vitest";
import { validateSubmission, readBoundedJson } from "../lib/submissions";
import { setIntakeStoreForTests, type IntakeStore } from "../lib/intake";
import { POST } from "../app/api/submissions/route";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const post = (body: unknown, headers: Record<string, string> = {}) =>
  POST(
    new Request("https://example.com/api/submissions", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
    }),
  );

const validReport = { url: "https://example.com/page", note: "neutral evidence" };

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  setIntakeStoreForTests(null);
});

describe("private report queue", () => {
  it.each([
    "http://127.0.0.1",
    "http://[::1]",
    "http://2130706433",
    "http://localhost.",
    "http://a.internal",
    "https://example.com/?%74oken=x",
    "https://example.com/#secret",
    "https://u:p@example.com",
    "file:///etc/passwd",
  ])("rejects %s", (url) => expect(() => validateSubmission({ url })).toThrow());

  it("bounds streaming input", async () => {
    await expect(
      readBoundedJson(
        new Request("https://example.com", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: '"' + "x".repeat(9000) + '"',
        }),
      ),
    ).rejects.toThrow("too large");
  });

  it("acknowledges only persisted reports", async () => {
    const dir = await mkdtemp(join(tmpdir(), "jev-intake-"));
    const file = join(dir, "queue.jsonl");
    vi.stubEnv("REGISTRY_DATA_FILE", file);
    vi.stubEnv("REGISTRY_ENABLE_SUBMISSIONS", "1");
    const response = await post(validReport);
    expect(response.status).toBe(202);
    const saved = JSON.parse(await readFile(file, "utf8"));
    expect(saved.status).toBe("pending_review");
    vi.stubEnv("REGISTRY_DATA_FILE", join(file, "impossible.jsonl"));
    const failed = await post({ url: "https://example.com/other" });
    expect(failed.status).toBe(503);
  });

  it("rejects a duplicate pending URL", async () => {
    const dir = await mkdtemp(join(tmpdir(), "jev-intake-"));
    vi.stubEnv("REGISTRY_DATA_FILE", join(dir, "queue.jsonl"));
    vi.stubEnv("REGISTRY_ENABLE_SUBMISSIONS", "1");
    expect((await post(validReport)).status).toBe(202);
    const duplicate = await post(validReport);
    expect(duplicate.status).toBe(409);
  });

  it("does not claim to persist discarded honeypot submissions", async () => {
    const dir = await mkdtemp(join(tmpdir(), "jev-intake-"));
    const file = join(dir, "queue.jsonl");
    vi.stubEnv("REGISTRY_DATA_FILE", file);
    vi.stubEnv("REGISTRY_ENABLE_SUBMISSIONS", "1");
    const response = await post({ ...validReport, website: "http://spam.example" });
    expect(response.status).toBe(403);
    await expect(readFile(file, "utf8")).rejects.toThrow();
  });

  it("rejects a cross-origin browser submission", async () => {
    vi.stubEnv("REGISTRY_ENABLE_SUBMISSIONS", "1");
    const response = await post(validReport, { origin: "https://evil.example" });
    expect(response.status).toBe(403);
  });

  it("rejects an invalid Turnstile token", async () => {
    vi.stubEnv("REGISTRY_ENABLE_SUBMISSIONS", "1");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "test-secret");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ success: false }), { status: 200 })),
    );
    const response = await post({ ...validReport, turnstileToken: "bad-token" });
    expect(response.status).toBe(403);
  });

  it("enforces the daily intake cap", async () => {
    const dir = await mkdtemp(join(tmpdir(), "jev-intake-"));
    vi.stubEnv("REGISTRY_DATA_FILE", join(dir, "queue.jsonl"));
    vi.stubEnv("REGISTRY_ENABLE_SUBMISSIONS", "1");
    vi.stubEnv("REGISTRY_DAILY_CAP", "1");
    expect((await post(validReport)).status).toBe(202);
    const capped = await post({ url: "https://example.com/second" });
    expect(capped.status).toBe(429);
  });

  it("surfaces store failures through the injected store", async () => {
    vi.stubEnv("REGISTRY_ENABLE_SUBMISSIONS", "1");
    const failing: IntakeStore = {
      insert: async () => {
        throw new Error("db down");
      },
      countSince: async () => 0,
    };
    setIntakeStoreForTests(failing);
    expect((await post(validReport)).status).toBe(503);
    const duplicating: IntakeStore = {
      insert: async () => ({ ok: false, duplicate: true }),
      countSince: async () => 0,
    };
    setIntakeStoreForTests(duplicating);
    expect((await post(validReport)).status).toBe(409);
  });

  it("is unavailable when no store is configured", async () => {
    vi.stubEnv("REGISTRY_ENABLE_SUBMISSIONS", "1");
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("REGISTRY_DATA_FILE", "");
    expect((await post(validReport)).status).toBe(503);
  });

  it("is read-only in production by default", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("REGISTRY_ENABLE_SUBMISSIONS", "");
    expect((await post(validReport)).status).toBe(503);
  });
});

it("serializes simultaneous local submissions against the cap", async () => {
 const dir=await mkdtemp(join(tmpdir(),"jev-cap-"));vi.stubEnv("REGISTRY_DATA_FILE",join(dir,"queue.jsonl"));vi.stubEnv("REGISTRY_DAILY_CAP","1");
 const responses=await Promise.all([post({url:"https://example.com/one"}),post({url:"https://example.com/two"})]);
 expect(responses.map(r=>r.status).sort()).toEqual([202,429]);
});
it("fails closed for enabled but incomplete production configuration", async () => {
 vi.stubEnv("NODE_ENV","production");vi.stubEnv("REGISTRY_ENABLE_SUBMISSIONS","1");vi.stubEnv("DATABASE_URL","");
 expect((await post(validReport)).status).toBe(503);
});
