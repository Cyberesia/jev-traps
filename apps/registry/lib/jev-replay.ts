import recordings from "@/data/jev-recordings.json";
export type RecordedCase = {
  id: string; label: string; text: string; goal: string; model: string | null;
  action: "allow" | "sanitize" | "review" | "block"; risk: number; durationMs: number;
  answers: Record<string, { noul?: number; choice?: string; confidence?: number }>;
  findings: { type: string; detector: string; confidence: number; severity: string }[];
};
export const recordedCases = recordings.cases as RecordedCase[];
export const recordedAt = recordings.recordedAt as string | null;
export const questionLabels = [
  ["agentInstruction", "Addresses the agent"], ["goalOverride", "Overrides the user’s goal"],
  ["secretRequest", "Requests private data"], ["toolManipulation", "Triggers a tool action"],
  ["navigationManipulation", "Redirects navigation"], ["benignQuotation", "Quotes a security example"],
] as const;

export const replayPolicy = recordings.policy;
