import { createTraps, requireAllowed } from "../../packages/sdk/src/index.js";

/** Wrap every retrieval tool in the host, before formatting a provider tool result. */
export async function guardedToolResult(content: string, goal: string, url?: string) {
  const traps = createTraps({
    semantic: Boolean(process.env.TYPESAFE_API_KEY),
    registry:
      process.env.JEV_TRAPS_REGISTRY_KEY && process.env.JEV_TRAPS_REGISTRY_ENDPOINT
        ? {
            endpoint: process.env.JEV_TRAPS_REGISTRY_ENDPOINT,
            apiKey: process.env.JEV_TRAPS_REGISTRY_KEY,
          }
        : undefined,
  });
  const report = await traps.inspectText(content, { goal, url });
  requireAllowed(report);
  return content; // Still untrusted data; never a system/developer message.
}
