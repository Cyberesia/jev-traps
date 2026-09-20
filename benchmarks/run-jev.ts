import { readFile } from "node:fs/promises";
import { inspectHtmlWithJev } from "../packages/jev/src/index.js";

if (!process.env.TYPESAFE_API_KEY) throw new Error("TYPESAFE_API_KEY is required for the live Jev benchmark.");
const raw = await readFile(new URL("./corpus.jsonl", import.meta.url), "utf8");
const all = raw.trim().split(/\n+/).map((line) => JSON.parse(line));
const limitFlag = process.argv.indexOf("--limit");
const limit = limitFlag >= 0 ? Number(process.argv[limitFlag + 1] ?? 0) : all.length;
const corpus = process.argv.includes("--smoke") ? [all.find(x => x.label === "attack"), all.find(x => x.label === "benign")] : Number.isFinite(limit) && limit > 0 ? all.slice(0, limit) : all;

function toHtml(sample: any) {
  const { node } = sample;
  const style: string[] = [];
  if (node.style?.display) style.push(`display:${node.style.display}`);
  if (node.style?.visibility) style.push(`visibility:${node.style.visibility}`);
  if (node.style?.opacity !== undefined) style.push(`opacity:${node.style.opacity}`);
  if (node.style?.fontSizePx !== undefined) style.push(`font-size:${node.style.fontSizePx}px`);
  if (node.style?.leftPx !== undefined) style.push(`position:absolute;left:${node.style.leftPx}px`);
  const attrs = `${style.length ? ` style="${style.join(";")}"` : ""}${node.visible === false && !style.length ? " hidden" : ""}`;
  const text = String(node.text).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  return node.href ? `<a href="${node.href}"${attrs}>${text}</a>` : `<div${attrs}>${text}</div>`;
}

const models = new Set<string>();
let tp=0, fp=0, tn=0, fn=0;
for (const sample of corpus) {
  const report = await inspectHtmlWithJev(toHtml(sample), { goal: sample.goal, timeout: 15000, maxSemanticCandidates: 2, onCall: event => { if (event.returnedModel) models.add(event.returnedModel); } });
  const predicted = report.action !== "allow";
  const actual = sample.label === "attack";
  if (predicted && actual) tp++; else if (predicted && !actual) fp++; else if (!predicted && !actual) tn++; else fn++;
  console.log(`${sample.id.padEnd(20)} ${sample.label.padEnd(6)} -> ${report.action.padEnd(8)} risk=${report.risk.toFixed(3)}`);
}
const precision = tp+fp ? tp/(tp+fp) : 0;
const recall = tp+fn ? tp/(tp+fn) : 0;
console.log(`\nLive Jev: ${corpus.length} samples | TP ${tp} FP ${fp} TN ${tn} FN ${fn} | precision ${(precision*100).toFixed(1)}% recall ${(recall*100).toFixed(1)}%`);
console.log(`Date ${new Date().toISOString()} | requested jev-latest | returned models: ${[...models].join(", ") || "unavailable"}`);
