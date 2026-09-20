import { createTraps, requireAllowed } from "../../packages/sdk/src/index.js";

/** Wrap every retrieval tool in the host, before formatting a provider tool result. */
export async function guardedToolResult(content: string, goal: string) {
  const traps = createTraps({ semantic: Boolean(process.env.TYPESAFE_API_KEY) });
  const report = await traps.inspectText(content, { goal });
  requireAllowed(report);
  return content; // Still untrusted data; never a system/developer message.
}
