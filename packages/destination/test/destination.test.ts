import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  canonicalizeDestination,
  evaluateDestinationSignals,
  evaluateSnapshot,
  loadSnapshot,
  SnapshotProvider,
  type DestinationRecord,
  type DestinationSnapshot,
} from "../src/index.js";
import { refreshUrlhausSnapshot } from "../src/urlhaus.js";

const dirs: string[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

function snapshot(records: DestinationRecord[], generatedAt = "2026-09-20T18:00:00.000Z"): DestinationSnapshot {
  return {
    metadata: {
      schemaVersion: 1,
      source: "fixture-feed",
      generatedAt,
      fetchedAt: generatedAt,
      timestampSource: "provider",
      recordCount: records.length,
      sha256: createHash("sha256").update(JSON.stringify(records)).digest("hex"),
    },
    records,
  };
}

describe("destination matching", () => {
  it("preserves security-relevant URL distinctions and removes only fragments", () => {
    expect(canonicalizeDestination("HTTPS://Example.COM:443/A?b=2&a=1#x")).toEqual({
      url: "https://example.com/A?b=2&a=1",
      hostname: "example.com",
    });
    expect(canonicalizeDestination("https://example.com/A").url).not.toBe(canonicalizeDestination("https://example.com/a").url);
    expect(canonicalizeDestination("https://example.com/?a=1&a=2").url).not.toBe(canonicalizeDestination("https://example.com/?a=2&a=1").url);
    expect(canonicalizeDestination("http://example.com/").url).not.toBe(canonicalizeDestination("https://example.com/").url);
    expect(() => canonicalizeDestination("https://user:secret@example.com/")).toThrow();
    expect(() => canonicalizeDestination("javascript:alert(1)")).toThrow();
  });

  it("stops only a fresh exact active URL and treats same-host paths as review", () => {
    const records = [{ canonicalUrl: "https://shared.example/bad?a=1", hostname: "shared.example", status: "online" as const }];
    const feed = snapshot(records);
    const now = new Date("2026-09-20T18:10:00.000Z");
    expect(evaluateSnapshot("https://shared.example/bad?a=1", feed, { now }).action).toBe("stop");
    expect(evaluateSnapshot("https://shared.example/good", feed, { now }).action).toBe("review");
    expect(evaluateSnapshot("https://other.example/good", feed, { now }).action).toBe("proceed");
  });

  it("downgrades stale exact evidence and ignores expired evidence for enforcement", () => {
    const record = [{ canonicalUrl: "https://bad.example/payload", hostname: "bad.example", status: "online" as const }];
    expect(evaluateSnapshot("https://bad.example/payload", snapshot(record, "2026-09-20T10:00:00Z"), { now: new Date("2026-09-20T18:00:00Z") }).action).toBe("review");
    expect(evaluateSnapshot("https://bad.example/payload", snapshot(record, "2026-09-18T10:00:00Z"), { now: new Date("2026-09-20T18:00:00Z") }).action).toBe("proceed");
  });

  it("routes independent Jev signals through deterministic thresholds", () => {
    const base = { impersonation: 0.02, credentialOrFundsRequest: 0.03, malwareDelivery: 0.01, deceptiveRedirect: 0.02, suspiciousHostname: 0.03, benignDestination: 0.98, role: "ordinary" as const };
    expect(evaluateDestinationSignals("https://example.com/", base).action).toBe("proceed");
    expect(evaluateDestinationSignals("https://brand-login.example/", { ...base, impersonation: 0.98, credentialOrFundsRequest: 0.95, benignDestination: 0.01, role: "login_or_checkout" }).action).toBe("stop");
    expect(evaluateDestinationSignals("https://unclear.example/", { ...base, role: "ambiguous" }).action).toBe("review");
  });

  it("indexes a validated snapshot without changing match behavior", () => {
    const feed = snapshot([{ canonicalUrl: "https://bad.example/x", hostname: "bad.example", status: "online" }]);
    expect(new SnapshotProvider(feed).lookup("https://bad.example/x", new Date("2026-09-20T18:10:00Z")).action).toBe("stop");
  });

  it("rejects tampered snapshots instead of treating them as intelligence", async () => {
    const dir = await mkdtemp(join(tmpdir(), "jev-destination-")); dirs.push(dir);
    const cachePath = join(dir, "tampered.json");
    const feed = snapshot([{ canonicalUrl: "https://bad.example/x", hostname: "bad.example", status: "online" }]);
    feed.records[0]!.threat = "changed-after-signing";
    await writeFile(cachePath, JSON.stringify(feed));
    await expect(loadSnapshot(cachePath)).rejects.toThrow("digest mismatch");
  });
});

describe("URLhaus updater", () => {
  it("parses quoted CSV, writes a private atomic snapshot and never stores the key", async () => {
    const dir = await mkdtemp(join(tmpdir(), "jev-destination-")); dirs.push(dir);
    const cachePath = join(dir, "urlhaus.json");
    const csv = [
      '"id","dateadded","url","url_status","last_online","threat","tags","urlhaus_link","reporter"',
      '"1","2026-09-20 17:00:00","https://bad.example/payload?a=1","online","2026-09-20 17:30:00","malware_download","tag,with,commas","https://urlhaus.example/1","tester"',
    ].join("\r\n");
    const fetcher = vi.fn(async () => new Response(csv, {
      headers: { "content-type": "text/csv", "last-modified": "Sun, 20 Sep 2026 18:00:00 GMT" },
    }));
    const result = await refreshUrlhausSnapshot({
      authKey: "abcdefghijklmnop",
      cachePath,
      minRecords: 1,
      fetch: fetcher,
      now: new Date("2026-09-20T18:01:00Z"),
    });
    expect(result.records).toHaveLength(1);
    expect((await stat(cachePath)).mode & 0o777).toBe(0o600);
    expect(await readFile(cachePath, "utf8")).not.toContain("abcdefghijklmnop");
    expect((await loadSnapshot(cachePath)).metadata.source).toBe("urlhaus");
    expect(String(fetcher.mock.calls[0]?.[0])).toContain("abcdefghijklmnop");
  });

  it("retains the last-known-good snapshot on malformed, tiny or redirected responses", async () => {
    const dir = await mkdtemp(join(tmpdir(), "jev-destination-")); dirs.push(dir);
    const cachePath = join(dir, "urlhaus.json");
    const goodCsv = '"id","dateadded","url","url_status","last_online","threat","tags","urlhaus_link","reporter"\n"1","","https://bad.example/x","online","","malware_download","","",""';
    await refreshUrlhausSnapshot({ authKey: "abcdefghijklmnop", cachePath, minRecords: 1, fetch: async () => new Response(goodCsv, { headers: { "content-type": "text/csv" } }) });
    const before = await readFile(cachePath, "utf8");
    await expect(refreshUrlhausSnapshot({ authKey: "abcdefghijklmnop", cachePath, minRecords: 2, fetch: async () => new Response(goodCsv, { headers: { "content-type": "text/csv" } }) })).rejects.toThrow("unexpectedly small");
    expect(await readFile(cachePath, "utf8")).toBe(before);
  });

  it("rejects invalid credentials, unexpected response types and future provider timestamps", async () => {
    const dir = await mkdtemp(join(tmpdir(), "jev-destination-")); dirs.push(dir);
    const cachePath = join(dir, "urlhaus.json");
    await expect(refreshUrlhausSnapshot({ authKey: "short", cachePath })).rejects.toThrow("Auth-Key");
    await expect(refreshUrlhausSnapshot({
      authKey: "abcdefghijklmnop", cachePath, minRecords: 1,
      fetch: async () => new Response("<html>login</html>", { headers: { "content-type": "text/html" } }),
    })).rejects.toThrow("content type");
    const csv = '"id","dateadded","url","url_status","last_online","threat","tags","urlhaus_link","reporter"\n"1","","https://bad.example/x","online","","malware_download","","",""';
    await expect(refreshUrlhausSnapshot({
      authKey: "abcdefghijklmnop", cachePath, minRecords: 1, now: new Date("2026-09-20T18:00:00Z"),
      fetch: async () => new Response(csv, { headers: { "content-type": "text/csv", "last-modified": "Sun, 20 Sep 2026 19:00:00 GMT" } }),
    })).rejects.toThrow("future");
  });
});
