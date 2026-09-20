export * from "./types.js";
export * from "./html.js";
export * from "./policy.js";
export * from "./sanitize.js";
export * from "./static.js";
export * from "./util.js";

import type { InspectOptions, InspectionReport } from "./types.js";
import { decideAction } from "./policy.js";
import { sanitizeHtml } from "./sanitize.js";
import { inspectHtmlStatic, inspectTextStatic } from "./static.js";

export const DETECTOR_VERSION = "0.1.0";

export function inspectText(text: string, options: InspectOptions = {}): InspectionReport {
  const findings = inspectTextStatic(text, options);
  const { action, risk } = decideAction(findings, undefined, options.policy);
  return {
    url: options.url,
    goal: options.goal,
    action,
    risk,
    findings,
    meta: { detectorVersion: DETECTOR_VERSION, staticFindings: findings.length, semanticFindings: 0 },
  };
}

export function inspectHtml(html: string, options: InspectOptions = {}): InspectionReport {
  const findings = inspectHtmlStatic(html, options);
  const { action, risk } = decideAction(findings, undefined, options.policy);
  return {
    url: options.url,
    goal: options.goal,
    action,
    risk,
    findings,
    sanitized: sanitizeHtml(html, findings),
    meta: { detectorVersion: DETECTOR_VERSION, staticFindings: findings.length, semanticFindings: 0 },
  };
}
