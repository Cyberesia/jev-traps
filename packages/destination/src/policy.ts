import { canonicalizeDestination } from "./canonical.js";
import type {
  DestinationIntelligenceMatch,
  DestinationPolicy,
  DestinationPreflight,
  DestinationSemanticSignals,
  DestinationSnapshot,
  IntelligenceFreshness,
} from "./types.js";

const DEFAULTS = {
  freshMs: 30 * 60_000,
  degradedMs: 6 * 60 * 60_000,
  staleMs: 24 * 60 * 60_000,
};

export function snapshotFreshness(
  snapshot: DestinationSnapshot,
  now = new Date(),
  policy: DestinationPolicy = {},
): IntelligenceFreshness {
  const age = now.getTime() - Date.parse(snapshot.metadata.generatedAt);
  if (!Number.isFinite(age) || age < -5 * 60_000) return "expired";
  if (age <= (policy.freshMs ?? DEFAULTS.freshMs)) return "fresh";
  if (age <= (policy.degradedMs ?? DEFAULTS.degradedMs)) return "degraded";
  if (age <= (policy.staleMs ?? DEFAULTS.staleMs)) return "stale";
  return "expired";
}

export function evaluateDestinationSignals(
  input: string,
  signals: DestinationSemanticSignals,
  options: { now?: Date; policy?: DestinationPolicy } = {},
): DestinationPreflight {
  const now = options.now ?? new Date();
  const { url, hostname } = canonicalizeDestination(input);
  const values = [
    signals.impersonation,
    signals.credentialOrFundsRequest,
    signals.malwareDelivery,
    signals.deceptiveRedirect,
    signals.suspiciousHostname,
    signals.benignDestination,
  ];
  if (values.some((value) => !Number.isFinite(value) || value < 0 || value > 1)) throw new Error("Invalid destination semantic response");
  const critical = Math.max(signals.impersonation, signals.credentialOrFundsRequest, signals.malwareDelivery);
  const suspicious = Math.max(critical, signals.deceptiveRedirect, signals.suspiciousHostname);
  const adjusted = suspicious * Math.max(0.15, 1 - signals.benignDestination * 0.8);
  const stop = options.policy?.semanticStopThreshold ?? 0.9;
  const review = options.policy?.semanticReviewThreshold ?? 0.65;
  const action = critical >= stop && signals.benignDestination < 0.4
    ? "stop"
    : adjusted >= review || signals.role === "ambiguous"
      ? "review"
      : "proceed";
  return {
    url,
    hostname,
    action,
    checkedAt: now.toISOString(),
    intelligence: "unavailable",
    matches: [],
    reason: action === "stop"
      ? "Atomic Jev judgments indicate a high-confidence credential, impersonation, or malware-delivery risk."
      : action === "review"
        ? "Atomic Jev judgments indicate destination ambiguity or manipulation signals that require review."
        : "Jev did not identify destination-level signals above the configured policy thresholds. This is not a safety guarantee.",
  };
}

export function evaluateSnapshot(
  input: string,
  snapshot: DestinationSnapshot | undefined,
  options: { now?: Date; policy?: DestinationPolicy } = {},
): DestinationPreflight {
  const now = options.now ?? new Date();
  const { url, hostname } = canonicalizeDestination(input);
  if (!snapshot) {
    return {
      url, hostname, action: "proceed", checkedAt: now.toISOString(),
      intelligence: "unavailable", matches: [],
      reason: "Destination intelligence is unavailable; no reputation claim was made.",
    };
  }

  const freshness = snapshotFreshness(snapshot, now, options.policy);
  const exact = snapshot.records.find((record) => record.canonicalUrl === url);
  const host = exact ? undefined : snapshot.records.find((record) => record.hostname === hostname);
  const record = exact ?? host;
  const scope = exact ? "exact_url" : "hostname";
  const matches: DestinationIntelligenceMatch[] = record ? [{
    source: snapshot.metadata.source,
    scope,
    freshness,
    reportedAt: snapshot.metadata.generatedAt,
    status: record.status,
    threat: record.threat,
  }] : [];

  if (exact && record?.status === "online" && (freshness === "fresh" || freshness === "degraded")) {
    return {
      url, hostname, action: "stop", checkedAt: now.toISOString(),
      intelligence: "available", matches,
      reason: "A maintained external feed reports this exact URL as actively distributing malware. Automatic retrieval was stopped.",
    };
  }
  if (record && freshness !== "expired" && (scope === "exact_url" || options.policy?.hostnameReview !== false)) {
    return {
      url, hostname, action: "review", checkedAt: now.toISOString(),
      intelligence: "available", matches,
      reason: scope === "hostname"
        ? "External intelligence reports this hostname; shared hosting is possible, so the match requires review."
        : "External intelligence contains this exact URL, but the evidence is stale or no longer marked online.",
    };
  }
  return {
    url, hostname, action: "proceed", checkedAt: now.toISOString(),
    intelligence: freshness === "expired" ? "expired" : "available", matches,
    reason: freshness === "expired"
      ? "Destination intelligence is expired and was not used for enforcement."
      : "No exact active-URL match was found. This is not a safety guarantee.",
  };
}
