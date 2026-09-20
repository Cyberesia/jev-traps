import type { Page } from "playwright";
import {
  decideAction,
  htmlToSafeText,
  inspectHtml,
  inspectTextStatic,
  makeId,
  sanitizeHtml,
  type InspectionReport,
  type TrapFinding,
} from "@jev-traps/core";
import { inspectHtmlWithJev, type JevInspectOptions } from "@jev-traps/jev";

export interface PageInspectOptions extends JevInspectOptions {
  semantic?: boolean;
  maxDomNodes?: number;
}

export interface SafeSnapshot {
  url: string;
  title: string;
  action: InspectionReport["action"];
  risk: number;
  findings: InspectionReport["findings"];
  html: string;
  text: string;
}

type ComputedNode = {
  selector: string;
  text: string;
  hidden: boolean;
  hiddenReasons: string[];
  href?: string;
};

async function captureComputedNodes(page: Page, maxNodes: number): Promise<ComputedNode[]> {
  return page.evaluate((limit) => {
    const esc = (value: string) => {
      const css = (globalThis as any).CSS;
      return css?.escape ? css.escape(value) : value.replace(/[^a-zA-Z0-9_-]/g, "\\$&");
    };
    const selectorFor = (el: Element): string => {
      if (el.id) return `#${esc(el.id)}`;
      const testId = el.getAttribute("data-testid");
      if (testId) return `[data-testid="${testId.replaceAll('"', '\\"')}"]`;
      const parts: string[] = [];
      let current: Element | null = el;
      while (current && parts.length < 4 && current.tagName.toLowerCase() !== "body") {
        let part = current.tagName.toLowerCase();
        const cls = Array.from(current.classList).find(Boolean);
        if (cls) part += `.${esc(cls)}`;
        else if (current.parentElement) {
          const siblings = Array.from(current.parentElement.children).filter((x) => x.tagName === current!.tagName);
          if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(current) + 1})`;
        }
        parts.unshift(part);
        current = current.parentElement;
      }
      return parts.join(" > ");
    };

    const nodes: ComputedNode[] = [];
    const elements = Array.from(document.querySelectorAll("body *")).slice(0, limit);
    for (const el of elements) {
      const text = (el.textContent ?? "").replace(/\s+/g, " ").trim();
      if (!text || text.length < 4) continue;
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      const opacity = Number.parseFloat(style.opacity || "1");
      const fontSize = Number.parseFloat(style.fontSize || "16");
      const reasons: string[] = [];
      if (style.display === "none") reasons.push("display:none");
      if (style.visibility === "hidden" || style.visibility === "collapse") reasons.push(`visibility:${style.visibility}`);
      if (Number.isFinite(opacity) && opacity <= 0.02) reasons.push(`opacity:${style.opacity}`);
      if (Number.isFinite(fontSize) && fontSize <= 1) reasons.push(`font-size:${style.fontSize}`);
      if (rect.width <= 1 && rect.height <= 1) reasons.push("1px-box");
      if (rect.right < -100 || rect.bottom < -100 || rect.left > innerWidth + 500 || rect.top > innerHeight + 500) reasons.push("off-screen");
      const href = el instanceof HTMLAnchorElement ? el.href : undefined;
      nodes.push({ selector: selectorFor(el), text: text.slice(0, 5000), hidden: reasons.length > 0, hiddenReasons: reasons, href });
    }
    return nodes;
  }, maxNodes);
}

function findingsFromComputedNodes(nodes: ComputedNode[], options: PageInspectOptions, url: string): TrapFinding[] {
  const out: TrapFinding[] = [];
  for (const node of nodes) {
    const lexical = inspectTextStatic(node.text, { ...options, url });
    const agentLike = lexical.some((f) => ["indirect_prompt_injection", "secret_exfiltration", "tool_manipulation", "navigation_hijacking"].includes(f.type));
    if (node.hidden && agentLike) {
      out.push({
        id: makeId("computed-hidden", node.selector, node.text, url),
        type: "hidden_instruction",
        detector: "static",
        confidence: 0.92,
        severity: "high",
        reason: `Browser-computed styles hide instruction-like content (${node.hiddenReasons.join(", ")})`,
        evidence: node.text.slice(0, options.maxEvidenceLength ?? 220),
        location: { selector: node.selector, url },
        tags: ["playwright-computed-style", ...node.hiddenReasons],
      });
    }
    if (node.href && /^(?:javascript|data|file):/i.test(node.href)) {
      out.push({
        id: makeId("computed-href", node.selector, node.href, url),
        type: "suspicious_scheme",
        detector: "static",
        confidence: 0.86,
        severity: "high",
        reason: "Browser-resolved link uses a potentially dangerous URL scheme",
        evidence: node.href.slice(0, options.maxEvidenceLength ?? 220),
        location: { selector: node.selector, attribute: "href", url },
        tags: ["playwright-resolved-url"],
      });
    }
  }
  return out;
}

const actionRank: Record<InspectionReport["action"], number> = { allow: 0, sanitize: 1, review: 2, block: 3 };

export async function inspectPage(page: Page, options: PageInspectOptions = {}): Promise<InspectionReport> {
  const html = await page.content();
  const url = options.url ?? page.url();
  const hasEnvKey = Boolean((globalThis as any).process?.env?.TYPESAFE_API_KEY);
  const base = options.semantic === false || (!options.client && !options.apiKey && !hasEnvKey)
    ? inspectHtml(html, { ...options, url })
    : await inspectHtmlWithJev(html, { ...options, url });

  const computed = await captureComputedNodes(page, options.maxDomNodes ?? 2000);
  const computedFindings = findingsFromComputedNodes(computed, options, url);
  const findings = [...base.findings];
  const existing = new Set(findings.map((f) => `${f.type}:${f.location?.selector ?? ""}:${f.evidence ?? ""}`));
  for (const finding of computedFindings) {
    const key = `${finding.type}:${finding.location?.selector ?? ""}:${finding.evidence ?? ""}`;
    if (!existing.has(key)) findings.push(finding);
  }

  const recalculated = decideAction(findings, undefined, options.policy);
  const action = actionRank[recalculated.action] > actionRank[base.action] ? recalculated.action : base.action;
  const risk = Math.max(base.risk, recalculated.risk);
  return {
    ...base,
    action,
    risk,
    findings,
    sanitized: sanitizeHtml(html, findings),
    meta: { ...base.meta, staticFindings: findings.filter((f) => f.detector === "static").length },
  };
}

export async function safeSnapshot(page: Page, options: PageInspectOptions = {}): Promise<SafeSnapshot> {
  const report = await inspectPage(page, options);
  // Withhold the entire frame until a verified selective sanitizer exists.
  // Re-reading a live DOM after inspection also risks content changing between reads.
  const blockedWithoutLocation = report.action !== "allow";
  const browserCopy = blockedWithoutLocation ? "[JEV_TRAPS_WITHHELD_PAGE]" : (report.sanitized ?? "[JEV_TRAPS_WITHHELD_PAGE]");
  const sanitized = sanitizeHtml(browserCopy, report.findings);
  return {
    url: report.url ?? page.url(),
    title: blockedWithoutLocation ? "[JEV_TRAPS_WITHHELD]" : "",
    action: report.action,
    risk: report.risk,
    findings: report.findings,
    html: sanitized,
    text: htmlToSafeText(sanitized),
  };
}

export async function assertPageAllowed(page: Page, options: PageInspectOptions = {}): Promise<InspectionReport> {
  const report = await inspectPage(page, options);
  if (report.action === "block") {
    const types = [...new Set(report.findings.map((x) => x.type))].join(", ");
    throw new Error(`Jev Traps blocked ${report.url ?? page.url()} (risk ${report.risk.toFixed(3)}; ${types})`);
  }
  return report;
}
