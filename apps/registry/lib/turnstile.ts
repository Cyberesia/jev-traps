/**
 * Cloudflare Turnstile server-side verification for the public intake form.
 * https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
 */
export async function verifyTurnstile(token: unknown, request: Request): Promise<{ ok: boolean }> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    // Local development may run without Turnstile. A production deployment
    // that enables intake must configure it: fail closed.
    return { ok: process.env.NODE_ENV !== "production" };
  }
  if (typeof token !== "string" || token.length === 0 || token.length > 4096) return { ok: false };

  const form = new URLSearchParams({ secret, response: token });
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (ip) form.set("remoteip", ip);

  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(5000),
    });
    const data = (await response.json()) as { success?: boolean };
    return { ok: data.success === true };
  } catch {
    return { ok: false };
  }
}
