import { inspectHtml, inspectText, type InspectOptions, type InspectionReport } from "@jev-traps/core";
import {
  canonicalizeDestination,
  evaluateDestinationSignals,
  type DestinationIntelligenceProvider,
  type DestinationPolicy,
  type DestinationPreflight,
} from "@jev-traps/destination";
import {
  classifyDestinationWithJev,
  inspectHtmlWithJev,
  inspectTextWithJev,
  type DestinationJevOptions,
  type JevInspectOptions,
} from "@jev-traps/jev";
import { inspectImage, type ImageInput, type ImageContext, type ImageInspectOptions } from "@jev-traps/vision";
import { reportBestEffort, publishObservation, type RegistryObservation, type RegistryOptions } from "./registry.js";
export * from "@jev-traps/core";
export { createVisionAdapter } from "@jev-traps/vision";
export type { ImageReport, ImageInput, ImageContext, Region } from "@jev-traps/vision";
export { observationFromReport, publishObservation } from "./registry.js";
export type { RegistryObservation, RegistryOptions, RegistryReceipt } from "./registry.js";
export type {
  DestinationAction,
  DestinationIntelligenceMatch,
  DestinationIntelligenceProvider,
  DestinationPolicy,
  DestinationPreflight,
  DestinationSnapshot,
} from "@jev-traps/destination";
export { canonicalizeDestination, evaluateSnapshot, loadSnapshot, SnapshotProvider } from "@jev-traps/destination";

export interface DestinationOptions {
  provider?: DestinationIntelligenceProvider;
  policy?: DestinationPolicy;
  /** Explicit opt-in: sends the URL and hostname to TypeSafe when feed policy has not stopped retrieval. */
  semantic?: boolean;
  jev?: DestinationJevOptions;
}

const destinationRank = { proceed: 0, review: 1, stop: 2 } as const;

/** Evaluate a destination before the host navigates or retrieves it. This function never fetches the destination. */
export async function preflightUrl(input: string, options: DestinationOptions = {}): Promise<DestinationPreflight> {
  const canonical = canonicalizeDestination(input);
  const checkedAt = new Date();
  const feed = options.provider
    ? await options.provider.lookup(canonical.url, checkedAt)
    : {
        url: canonical.url,
        hostname: canonical.hostname,
        action: "proceed" as const,
        checkedAt: checkedAt.toISOString(),
        intelligence: "unavailable" as const,
        matches: [],
        reason: "Destination intelligence is not configured; no reputation claim was made.",
      };
  if (feed.action === "stop" || !options.semantic) return feed;
  let semanticCall: { requestedModel: string; returnedModel: string | null } | undefined;
  const signals = await classifyDestinationWithJev(canonical.url, {
    ...options.jev,
    onCall: (event) => {
      semanticCall = event;
      options.jev?.onCall?.(event);
    },
  });
  const semantic = evaluateDestinationSignals(canonical.url, signals, { now: checkedAt, policy: options.policy });
  if (destinationRank[feed.action] >= destinationRank[semantic.action]) return { ...feed, semantic: semanticCall };
  return {
    ...semantic,
    intelligence: feed.intelligence,
    matches: feed.matches,
    reason: semantic.reason,
    semantic: semanticCall,
  };
}

/** All decisions execute in the host, independent of the agent's model provider. */
export function createTraps(options: {
  semantic?: boolean;
  jev?: JevInspectOptions;
  vision?: ImageInspectOptions;
  registry?: RegistryOptions;
  destination?: DestinationOptions;
} = {}) {
  const inspectTextAndReport = async (text: string, context: InspectOptions = {}): Promise<InspectionReport> => {
    const report = options.semantic
      ? await inspectTextWithJev(text, { ...options.jev, ...context })
      : inspectText(text, context);
    await reportBestEffort(report, "text", options.registry);
    return report;
  };
  const inspectHtmlAndReport = async (html: string, context: InspectOptions = {}): Promise<InspectionReport> => {
    const report = options.semantic
      ? await inspectHtmlWithJev(html, { ...options.jev, ...context })
      : inspectHtml(html, context);
    await reportBestEffort(report, "html", options.registry);
    return report;
  };
  const inspectImageAndReport = async (
    input: { image: ImageInput; context: ImageContext },
    vision: ImageInspectOptions,
  ) => {
    const report = await inspectImage(input, vision);
    if (options.registry && report.action !== "allow" && input.context.url) {
      try {
        const base = new URL(input.context.url);
        base.search = "";
        base.hash = "";
        const observation: RegistryObservation = {
          schemaVersion: 1,
          url: base.toString(),
          action: report.action,
          risk: report.risk ?? 0,
          trapTypes: ["visual_prompt_injection"],
          detectorVersion: `vision:${report.meta.provider}/${report.meta.visionModel ?? "unknown"}`,
          observedAt: new Date().toISOString(),
          surface: "image",
        };
        await publishObservation(observation, options.registry);
      } catch (error) {
        options.registry.onError?.(error instanceof Error ? error : new Error("Registry reporting failed"));
      }
    }
    return report;
  };
  return {
    preflightUrl: (url: string) => preflightUrl(url, options.destination),
    inspectText: inspectTextAndReport,
    inspectHtml: inspectHtmlAndReport,
    inspectImage: (input: { image: ImageInput; context: ImageContext }) => {
      if (!options.vision) throw new Error("Configure a vision adapter explicitly before sending images");
      return inspectImageAndReport(input, options.vision);
    },
    /** Explicit reporting for custom pipelines. Raw evidence is never included. */
    reportObservation: (observation: RegistryObservation) => {
      if (!options.registry) throw new Error("Configure registry before publishing observations");
      return publishObservation(observation, options.registry);
    },
  };
}

/** Safe default for agent tool middleware: only allow advances automatically. */
export function requireAllowed(report: { action: string }): void {
  if (report.action !== "allow") throw new Error(`Jev Traps withheld content: ${report.action}`);
}
