export const AGENT_DIRECTED_PATTERNS: RegExp[] = [
  /ignore\s+(?:all\s+)?(?:previous|prior|earlier)\s+instructions?/i,
  /(?:system|developer)\s*(?:message|instruction|prompt)\s*:/i,
  /\b(?:system|assistant|agent|llm)\s*:\s*(?:you\s+must|must|should|ignore|follow|disregard|redirect|navigate|print|reveal|send|upload|execute|call|use)\b/i,
  /\bai\s+agents?\s+(?:must|should|need\s+to)\b/i,
  /do\s+not\s+(?:tell|show|inform|answer)\s+(?:the\s+)?user/i,
  /\b(?:ai|assistant|agent|llm)s?\s*[:,-]?\s*(?:you\s+must|must|should|ignore|follow|execute|redirect|navigate)/i,
  /override\s+(?:the\s+|your\s+)?(?:user|task|goal|instructions?)/i,
  /(?:ignore|disregard)\s+(?:the\s+|their\s+|your\s+)?(?:user|task|goal|instructions?)/i,
  /(?:real|new)\s+objective\s+is\s+to/i,
];

export const SECRET_PATTERNS: RegExp[] = [
  /(?:send|post|upload|reveal|expose|return|print|message)\b.{0,80}\b(?:api\s*key|cookie|token|password|credential|secret|private\s+context|conversation|system\s*prompt)/i,
  /(?:read|extract|collect|retrieve)\b.{0,60}\b(?:localstorage|sessionstorage|document\.cookie|authorization\s+header|authentication\s+token|credential)/i,
  /(?:contents?\s+of\s+)?(?:private\s+context|system\s+prompt)\b.{0,80}\b(?:send|upload|message|post)/i,
];

export const NEGATED_SECRET_PATTERN = /\b(?:never|do\s+not|don't|should\s+not|must\s+not|cannot|can't|we\s+do\s+not)\b.{0,45}\b(?:send|post|upload|reveal|expose|return|print|message)\b/i;

export const TOOL_PATTERNS: RegExp[] = [
  /(?:run|execute|call|invoke|use)\b.{0,80}\b(?:shell|terminal|bash|powershell|tool|mcp|function|command)/i,
  /(?:use\s+the\s+tool|call\s+the\s+tool)\b.{0,80}\b(?:delete|purchase|message|send|write|modify)/i,
  /(?:curl|wget|fetch)\s+https?:\/\//i,
];

export const NAV_PATTERNS: RegExp[] = [
  /(?:navigate|visit|open|redirect|go)\b.{0,80}\bhttps?:\/\//i,
  /(?:send|post|upload)\b.{0,80}\bhttps?:\/\//i,
];

export const ZERO_WIDTH = /[\u200B-\u200F\u202A-\u202E\u2060\u2061\u2062\u2063\u2064\u2066-\u206F\uFEFF]/g;
export const ENCODED_BLOB = /\b(?:[A-Za-z0-9+/]{32,}={0,2}){2,}\b/;
