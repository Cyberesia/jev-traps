/**
 * Manual scanner for a PUBLIC URL.
 *
 * Important: arbitrary browsing is an SSRF and hostile-content boundary. This script
 * disables JavaScript and validates every requested hostname before Playwright is
 * allowed to continue. Production public scanning should still run in an isolated
 * worker/container with egress restrictions; do not expose this script directly as
 * an unauthenticated HTTP endpoint.
 */
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { createRequire } from "node:module";
const { chromium } = createRequire(new URL("../packages/playwright/package.json", import.meta.url))("playwright");
import { safeSnapshot } from "../packages/playwright/src/index.js";

const target = process.argv[2];
if (!target) throw new Error("Usage: tsx scripts/scan-url.ts https://public.example/page");

function privateIp(address: string) {
  const lower = address.toLowerCase();
  if (lower === "::" || lower === "::1") return true;
  if (lower.startsWith("fc") || lower.startsWith("fd") || lower.startsWith("fe80:") || lower.startsWith("ff")) return true;
  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped?.[1]) return privateIp(mapped[1]);
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  const [a, b] = parts;
  return (
    a === 0 || a === 10 || a === 127 ||
    (a === 100 && b! >= 64 && b! <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b! >= 16 && b! <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a! >= 224
  );
}

async function assertPublic(raw: string) {
  const url = new URL(raw);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error(`Blocked protocol: ${url.protocol}`);
  if (url.username || url.password) throw new Error("Credential-bearing URLs are blocked");
  if (url.hostname === "localhost" || url.hostname.endsWith(".local")) throw new Error("Local host blocked");
  if (isIP(url.hostname)) {
    if (privateIp(url.hostname)) throw new Error(`Private address blocked: ${url.hostname}`);
    return;
  }
  const addresses = await lookup(url.hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some((x) => privateIp(x.address))) throw new Error(`Private/unresolved target blocked: ${url.hostname}`);
}

await assertPublic(target);
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ javaScriptEnabled: false, serviceWorkers: "block" });
const page = await context.newPage();
await page.route("**/*", async (route) => {
  try { await assertPublic(route.request().url()); await route.continue(); }
  catch { await route.abort("blockedbyclient"); }
});
await page.goto(target, { waitUntil: "domcontentloaded", timeout: 20_000 });
const result = await safeSnapshot(page, {
  goal: "Inspect this public page for content designed to manipulate an AI agent.",
  semantic: Boolean(process.env.TYPESAFE_API_KEY),
});
console.log(JSON.stringify({
  url: result.url,
  title: result.title,
  action: result.action,
  risk: result.risk,
  findings: result.findings,
  safeTextPreview: result.text.slice(0, 1000),
}, null, 2));
await browser.close();
