export const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));

// Fast deterministic non-cryptographic id for findings. Registry evidence should use a
// cryptographic digest server-side when persistence/integrity matters.
export const makeId = (...parts: Array<string | undefined>): string => {
  const input = parts.filter(Boolean).join("\u0000");
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 ^= c;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= c + ((h1 >>> 16) & 0xffff);
    h2 = Math.imul(h2, 0x85ebca6b);
  }
  return `${(h1 >>> 0).toString(16).padStart(8, "0")}${(h2 >>> 0).toString(16).padStart(8, "0")}`;
};

export const cleanEvidence = (value: string, max = 220): string => {
  const compact = value.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();
  const redacted = compact
    .replace(/(?:sk|pk|api|token|bearer)[-_ ]?[a-z0-9]{12,}/gi, "[REDACTED_TOKEN]")
    .replace(/([?&](?:token|key|secret|session|auth)=)[^&\s]+/gi, "$1[REDACTED]");
  return redacted.length > max ? `${redacted.slice(0, max - 1)}…` : redacted;
};
