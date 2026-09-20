import { createTraps, loadSnapshot, requireAllowed, SnapshotProvider } from "../../packages/sdk/src/index.js";

const destinationProvider = process.env.JEV_TRAPS_DESTINATION_SNAPSHOT
  ? new SnapshotProvider(await loadSnapshot(process.env.JEV_TRAPS_DESTINATION_SNAPSHOT))
  : undefined;

const traps = createTraps({
  semantic: Boolean(process.env.TYPESAFE_API_KEY),
  destination: {
    provider: destinationProvider,
    semantic: process.env.JEV_TRAPS_DESTINATION_JEV === "1" && Boolean(process.env.TYPESAFE_API_KEY),
  },
  registry:
    process.env.JEV_TRAPS_REGISTRY_KEY && process.env.JEV_TRAPS_REGISTRY_ENDPOINT
      ? {
          endpoint: process.env.JEV_TRAPS_REGISTRY_ENDPOINT,
          apiKey: process.env.JEV_TRAPS_REGISTRY_KEY,
        }
      : undefined,
});

/** Call before the retrieval tool. The SDK never navigates or overrides this result. */
export async function guardedDestination(url: string) {
  const result = await traps.preflightUrl(url);
  if (result.action !== "proceed") throw new Error(`Destination withheld: ${result.reason}`);
  return result;
}

/** Wrap every retrieval tool in the host, before formatting a provider tool result. */
export async function guardedToolResult(content: string, goal: string, url?: string) {
  const report = await traps.inspectText(content, { goal, url });
  requireAllowed(report);
  return content; // Still untrusted data; never a system/developer message.
}
