import { readFile } from "node:fs/promises";
import { inspectHtml } from "../packages/core/dist/index.js";

const raw = await readFile(new URL("./corpus.jsonl", import.meta.url), "utf8");
const corpus = raw.trim().split(/\n+/).map((line) => JSON.parse(line));

function toHtml(sample) {
  const { node } = sample;
  const style = [];
  if (node.style?.display) style.push(`display:${node.style.display}`);
  if (node.style?.visibility) style.push(`visibility:${node.style.visibility}`);
  if (node.style?.opacity !== undefined) style.push(`opacity:${node.style.opacity}`);
  if (node.style?.fontSizePx !== undefined) style.push(`font-size:${node.style.fontSizePx}px`);
  if (node.style?.leftPx !== undefined) style.push(`position:absolute;left:${node.style.leftPx}px`);
  const styleAttr = style.length ? ` style="${style.join(';')}"` : "";
  const hiddenAttr = node.visible === false && !style.length ? " hidden" : "";
  const safeText = String(node.text).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  if (node.href) return `<a href="${String(node.href).replaceAll('"','&quot;')}"${styleAttr}${hiddenAttr}>${safeText}</a>`;
  return `<div${styleAttr}${hiddenAttr}>${safeText}</div>`;
}

let candidateTP = 0, candidateFP = 0, candidateTN = 0, candidateFN = 0;
let actionTP = 0, actionFP = 0, actionTN = 0, actionFN = 0;
const rows = [];
const started = performance.now();
for (const sample of corpus) {
  const report = inspectHtml(toHtml(sample), { goal: sample.goal });
  const actualTrap = sample.label === "attack";
  const candidate = report.findings.length > 0;
  const actionable = report.action !== "allow";
  if (candidate && actualTrap) candidateTP++; else if (candidate && !actualTrap) candidateFP++; else if (!candidate && !actualTrap) candidateTN++; else candidateFN++;
  if (actionable && actualTrap) actionTP++; else if (actionable && !actualTrap) actionFP++; else if (!actionable && !actualTrap) actionTN++; else actionFN++;
  rows.push({ id: sample.id, expected: sample.label, findings: report.findings.length, action: report.action, risk: report.risk.toFixed(3) });
}
const ms = performance.now() - started;
console.table(rows);
const metric = (tp, fp, fn) => ({ precision: tp + fp ? tp / (tp + fp) : 0, recall: tp + fn ? tp / (tp + fn) : 0 });
const c = metric(candidateTP, candidateFP, candidateFN);
const a = metric(actionTP, actionFP, actionFN);
console.log(`\nCorpus: ${corpus.length}`);
console.log(`Static candidate prefilter: TP ${candidateTP} FP ${candidateFP} TN ${candidateTN} FN ${candidateFN} | precision ${(c.precision*100).toFixed(1)}% recall ${(c.recall*100).toFixed(1)}%`);
console.log(`Static actionable policy:  TP ${actionTP} FP ${actionFP} TN ${actionTN} FN ${actionFN} | precision ${(a.precision*100).toFixed(1)}% recall ${(a.recall*100).toFixed(1)}%`);
console.log(`Runtime ${ms.toFixed(1)}ms`);
console.log("The prefilter is intentionally permissive; Jev is responsible for semantic disambiguation before high-impact actions.");
