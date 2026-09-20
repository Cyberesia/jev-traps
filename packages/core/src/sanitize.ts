import { stripTags } from "./html.js";
import type { TrapFinding } from "./types.js";
import { ZERO_WIDTH } from "./patterns.js";

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");


function removeBySelector(html: string, selector: string): string {
  const escaped = escapeRegex(selector.replace(/^#/, ""));
  if (selector.startsWith("#")) {
    return html.replace(new RegExp(`<([a-zA-Z][\\w:-]*)\\b[^>]*\\bid=[\"']${escaped}[\"'][^>]*>[\\s\\S]*?<\\/\\1\\s*>`, "gi"), "[JEV_TRAPS_REMOVED_SEMANTIC_TRAP]");
  }
  const testId = selector.match(/^\[data-testid="(.+)"\]$/);
  if (testId?.[1]) {
    const id = escapeRegex(testId[1]);
    return html.replace(new RegExp(`<([a-zA-Z][\\w:-]*)\\b[^>]*data-testid=[\"']${id}[\"'][^>]*>[\\s\\S]*?<\\/\\1\\s*>`, "gi"), "[JEV_TRAPS_REMOVED_SEMANTIC_TRAP]");
  }
  return html;
}

export function sanitizeHtml(html: string, findings: TrapFinding[] = []): string {
  let out = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, "")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript\s*>/gi, "")
    .replace(/<(?:iframe|object|embed)\b[^>]*>[\s\S]*?<\/(?:iframe|object|embed)\s*>/gi, "");

  const suspiciousHidden = findings.filter((f) => f.type === "hidden_instruction" && f.confidence >= 0.7);
  for (const finding of suspiciousHidden) {
    const evidence = finding.evidence?.slice(0, 80);
    if (!evidence) continue;
    const normalized = evidence.replace(/\s+/g, " ").trim();
    if (!normalized) continue;
    const leading = normalized.split(" ").slice(0, 5).join(" ");
    if (leading.length < 8) continue;
    const pair = new RegExp(`<([a-zA-Z][\\w:-]*)\\b[^>]*(?:hidden|aria-hidden|display\\s*:\\s*none|visibility\\s*:\\s*hidden|opacity\\s*:\\s*0)[^>]*>[\\s\\S]*?${escapeRegex(leading)}[\\s\\S]*?<\\/\\1\\s*>`, "gi");
    out = out.replace(pair, "[JEV_TRAPS_REMOVED_SUSPECTED_AGENT_INSTRUCTION]");
  }

  for (const finding of findings) {
    if (finding.detector === "semantic" && finding.confidence >= 0.75 && finding.location?.selector) {
      out = removeBySelector(out, finding.location.selector);
    }
  }

  out = out.replace(/href\s*=\s*(["'])(?:javascript|data|file):[\s\S]*?\1/gi, 'href="#jev-traps-blocked"');
  return out.replace(ZERO_WIDTH, "");
}

export function htmlToSafeText(html: string): string {
  return stripTags(html.replace(ZERO_WIDTH, ""));
}
