const MAX_URL_LENGTH = 8_192;

export function canonicalizeDestination(input: string): { url: string; hostname: string } {
  if (typeof input !== "string" || input.length === 0 || input.length > MAX_URL_LENGTH || /[\u0000-\u001f\u007f]/.test(input)) {
    throw new Error("Invalid destination URL");
  }
  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    throw new Error("Invalid destination URL");
  }
  if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password || !parsed.hostname) {
    throw new Error("Destination must be a public HTTP(S) URL without credentials");
  }
  parsed.hash = "";
  return { url: parsed.toString(), hostname: parsed.hostname.toLowerCase() };
}
