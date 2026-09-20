import { extractElements, extractOpeningTags, stripTags } from "./html.js";
import {
  AGENT_DIRECTED_PATTERNS,
  ENCODED_BLOB,
  NAV_PATTERNS,
  NEGATED_SECRET_PATTERN,
  SECRET_PATTERNS,
  TOOL_PATTERNS,
  ZERO_WIDTH,
} from "./patterns.js";
import type { InspectOptions, TrapFinding, TrapType } from "./types.js";
import { cleanEvidence, makeId } from "./util.js";

const lexicalFinding = (
  type: TrapType,
  text: string,
  reason: string,
  confidence: number,
  severity: TrapFinding["severity"],
  options: InspectOptions,
): TrapFinding => ({
  id: makeId(type, text, options.url),
  type,
  detector: "static",
  confidence,
  severity,
  reason,
  evidence: cleanEvidence(text, options.maxEvidenceLength),
  location: options.url ? { url: options.url } : undefined,
});

export function inspectTextStatic(text: string, options: InspectOptions = {}): TrapFinding[] {
  const out: TrapFinding[] = [];
  for (const pattern of AGENT_DIRECTED_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      out.push(lexicalFinding("indirect_prompt_injection", match[0], "Agent-directed instruction pattern", 0.58, "medium", options));
      break;
    }
  }
  if (!NEGATED_SECRET_PATTERN.test(text)) {
    for (const pattern of SECRET_PATTERNS) {
      const match = text.match(pattern);
      if (match) {
        // Secret language is a strong semantic candidate but not a static blocking fact.
        out.push(lexicalFinding("secret_exfiltration", match[0], "Possible request to disclose private agent or user data", 0.5, "medium", options));
        break;
      }
    }
  }
  for (const pattern of TOOL_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      out.push(lexicalFinding("tool_manipulation", match[0], "Possible instruction to invoke a privileged tool", 0.55, "medium", options));
      break;
    }
  }
  for (const pattern of NAV_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      out.push(lexicalFinding("navigation_hijacking", match[0], "Possible agent-directed navigation or outbound transfer", 0.48, "medium", options));
      break;
    }
  }
  const zw = text.match(ZERO_WIDTH);
  if (zw && zw.length >= 2) {
    out.push(lexicalFinding("obfuscated_instruction", text, `Contains ${zw.length} zero-width or bidi control characters`, Math.min(0.9, 0.35 + zw.length / 30), "medium", options));
  }
  if (ENCODED_BLOB.test(text)) {
    out.push(lexicalFinding("obfuscated_instruction", text, "Contains a long encoded-looking payload that may hide agent instructions", 0.44, "medium", options));
  }
  return out;
}

const styleIsHidden = (style = ""): string | null => {
  const normalized = style.toLowerCase().replace(/\s+/g, "");
  if (/display:none(?:;|$)/.test(normalized)) return "display:none";
  if (/visibility:hidden(?:;|$)/.test(normalized)) return "visibility:hidden";
  if (/opacity:0(?:[;}]|$)/.test(normalized)) return "opacity:0";
  const font = normalized.match(/font-size:(0(?:px|rem|em|%)?|0?\.\d+px|1px)(?:;|$)/);
  if (font) return `font-size:${font[1]}`;
  if (/(?:left|top):-\d{4,}(?:px)?/.test(normalized)) return "off-screen-position";
  if (/clip(?:-path)?:[^;]*(?:inset\(100%\)|rect\(0)/.test(normalized)) return "clipped";
  return null;
};

export function inspectHtmlStatic(html: string, options: InspectOptions = {}): TrapFinding[] {
  const out = inspectTextStatic(stripTags(html), options);

  for (const el of extractElements(html)) {
    if (!el.text) continue;
    const hiddenBy = Object.hasOwn(el.attrs, "hidden")
      ? "hidden attribute"
      : el.attrs["aria-hidden"]?.toLowerCase() === "true"
        ? "aria-hidden=true"
        : styleIsHidden(el.attrs.style);
    if (!hiddenBy) continue;
    const lexical = inspectTextStatic(el.text, options);
    const instructionLike = lexical.some((x) => x.type === "indirect_prompt_injection" || x.type === "secret_exfiltration" || x.type === "tool_manipulation");
    out.push({
      id: makeId("hidden_instruction", el.text, el.selector, options.url),
      type: "hidden_instruction",
      detector: "static",
      confidence: instructionLike ? 0.86 : 0.32,
      severity: instructionLike ? "high" : "low",
      reason: `Text is hidden from normal presentation via ${hiddenBy}${instructionLike ? " and contains agent-directed language" : ""}`,
      evidence: cleanEvidence(el.text, options.maxEvidenceLength),
      location: { selector: el.selector, url: options.url },
      tags: [hiddenBy],
    });
  }

  for (const el of extractOpeningTags(html)) {
    if (el.tag !== "a") continue;
    const href = (el.attrs.href ?? "").trim();
    if (!/^(?:javascript|data|file):/i.test(href)) continue;
    out.push({
      id: makeId("suspicious_scheme", href, options.url),
      type: "suspicious_scheme",
      detector: "static",
      confidence: /^javascript:/i.test(href) ? 0.85 : 0.65,
      severity: /^javascript:/i.test(href) ? "high" : "medium",
      reason: `Link uses a potentially dangerous ${href.split(":", 1)[0]}: scheme`,
      evidence: cleanEvidence(href, options.maxEvidenceLength),
      location: { selector: el.selector, attribute: "href", url: options.url },
    });
  }

  return dedupe(out);
}

export function isVisuallyHiddenStyle(style?: string): boolean {
  return Boolean(styleIsHidden(style));
}

const dedupe = (findings: TrapFinding[]): TrapFinding[] => {
  const seen = new Set<string>();
  return findings.filter((f) => {
    const key = `${f.type}:${f.location?.selector ?? ""}:${f.evidence ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};
