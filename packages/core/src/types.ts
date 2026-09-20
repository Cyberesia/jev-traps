export type TrapType =
  | "indirect_prompt_injection"
  | "goal_hijacking"
  | "secret_exfiltration"
  | "tool_manipulation"
  | "navigation_hijacking"
  | "hidden_instruction"
  | "obfuscated_instruction"
  | "suspicious_scheme"
  | "visual_prompt_injection";

export type TrapAction = "allow" | "sanitize" | "review" | "block";
export type DetectorKind = "static" | "semantic";
export type Severity = "info" | "low" | "medium" | "high" | "critical";

export interface TrapLocation {
  selector?: string;
  attribute?: string;
  url?: string;
  start?: number;
  end?: number;
}

export interface TrapFinding {
  id: string;
  type: TrapType;
  detector: DetectorKind;
  confidence: number;
  severity: Severity;
  reason: string;
  evidence?: string;
  location?: TrapLocation;
  tags?: string[];
}

export interface InspectOptions {
  url?: string;
  goal?: string;
  maxEvidenceLength?: number;
  policy?: Partial<TrapPolicy>;
}

export interface TrapPolicy {
  blockRisk: number;
  reviewRisk: number;
  sanitizeRisk: number;
  semanticBlockThreshold: number;
  hiddenSemanticThreshold: number;
}

export interface InspectionReport {
  url?: string;
  goal?: string;
  action: TrapAction;
  risk: number;
  findings: TrapFinding[];
  sanitized?: string;
  meta: {
    detectorVersion: string;
    staticFindings: number;
    semanticFindings: number;
  };
}

export interface SemanticSignals {
  agentInstruction: number;
  goalOverride: number;
  secretRequest: number;
  toolManipulation: number;
  navigationManipulation: number;
  benignQuotation: number;
  role: "content" | "instruction" | "interface" | "security_example" | "ambiguous";
  roleConfidence: number;
}
