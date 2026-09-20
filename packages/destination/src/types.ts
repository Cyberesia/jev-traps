export type DestinationAction = "proceed" | "review" | "stop";
export type IntelligenceScope = "exact_url" | "hostname";
export type IntelligenceFreshness = "fresh" | "degraded" | "stale" | "expired";

export interface DestinationRecord {
  canonicalUrl: string;
  hostname: string;
  status: "online" | "offline" | "unknown";
  dateAdded?: string;
  lastOnline?: string;
  threat?: string;
}

export interface DestinationSnapshotMetadata {
  schemaVersion: 1;
  source: string;
  generatedAt: string;
  fetchedAt: string;
  timestampSource: "provider" | "retrieval";
  recordCount: number;
  sha256: string;
}

export interface DestinationSnapshot {
  metadata: DestinationSnapshotMetadata;
  records: DestinationRecord[];
}

export interface DestinationIntelligenceMatch {
  source: string;
  scope: IntelligenceScope;
  freshness: IntelligenceFreshness;
  reportedAt: string;
  status: DestinationRecord["status"];
  threat?: string;
}

export interface DestinationPreflight {
  url: string;
  hostname: string;
  action: DestinationAction;
  checkedAt: string;
  intelligence: "available" | "unavailable" | "expired";
  matches: DestinationIntelligenceMatch[];
  reason: string;
  semantic?: { requestedModel: string; returnedModel: string | null };
}

export interface DestinationPolicy {
  freshMs?: number;
  degradedMs?: number;
  staleMs?: number;
  hostnameReview?: boolean;
  semanticStopThreshold?: number;
  semanticReviewThreshold?: number;
}

export interface DestinationSemanticSignals {
  impersonation: number;
  credentialOrFundsRequest: number;
  malwareDelivery: number;
  deceptiveRedirect: number;
  suspiciousHostname: number;
  benignDestination: number;
  role: "ordinary" | "login_or_checkout" | "redirector" | "download" | "ambiguous";
}

export interface DestinationIntelligenceProvider {
  lookup(url: string, now?: Date): Promise<DestinationPreflight> | DestinationPreflight;
}
