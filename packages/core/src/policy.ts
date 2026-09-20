import type { SemanticSignals, TrapAction, TrapFinding, TrapPolicy } from "./types.js";
import { clamp01 } from "./util.js";

export const DEFAULT_POLICY: TrapPolicy = {
  blockRisk: 0.9,
  reviewRisk: 0.67,
  sanitizeRisk: 0.42,
  semanticBlockThreshold: 0.92,
  hiddenSemanticThreshold: 0.74,
};

const severityWeight: Record<TrapFinding["severity"], number> = {
  info: 0.05,
  low: 0.15,
  medium: 0.38,
  high: 0.72,
  critical: 0.95,
};

export function calculateRisk(findings: TrapFinding[]): number {
  if (!findings.length) return 0;
  const contributions = findings
    .map((f) => clamp01(f.confidence * (0.55 + severityWeight[f.severity] * 0.45)))
    .sort((a, b) => b - a);
  const top = contributions[0] ?? 0;
  const support = contributions.slice(1, 4).reduce((sum, x, i) => sum + x * [0.28, 0.16, 0.08][i]!, 0);
  return clamp01(top + support);
}

export function decideAction(
  findings: TrapFinding[],
  semantic: SemanticSignals | undefined,
  overrides: Partial<TrapPolicy> = {},
): { action: TrapAction; risk: number } {
  const policy = { ...DEFAULT_POLICY, ...overrides };
  let risk = calculateRisk(findings);

  if (semantic) {
    const malicious = Math.max(
      semantic.agentInstruction,
      semantic.goalOverride,
      semantic.secretRequest,
      semantic.toolManipulation,
      semantic.navigationManipulation,
    );
    const benignDiscount = Math.max(0.15, 1 - semantic.benignQuotation * 0.7);
    risk = clamp01(Math.max(risk, malicious * benignDiscount));

    const hidden = findings.some((f) => f.type === "hidden_instruction");
    if (hidden && semantic.agentInstruction >= policy.hiddenSemanticThreshold) {
      risk = Math.max(risk, 0.88);
    }
    if (semantic.secretRequest >= policy.semanticBlockThreshold || semantic.goalOverride >= policy.semanticBlockThreshold) {
      risk = Math.max(risk, policy.blockRisk);
    }
  }

  const action: TrapAction = risk >= policy.blockRisk
    ? "block"
    : risk >= policy.reviewRisk
      ? "review"
      : risk >= policy.sanitizeRisk
        ? "sanitize"
        : "allow";

  return { action, risk };
}
