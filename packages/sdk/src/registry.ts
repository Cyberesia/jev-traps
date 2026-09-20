import type { InspectionReport, TrapAction, TrapType } from "@jev-traps/core";

export interface RegistryOptions {
  /** Registry origin or observations endpoint. Example: https://traps.example */
  endpoint: string;
  /** Server-side ingestion key issued by the Registry operator. */
  apiKey: string;
  /** Abort reporting after this delay. Defaults to 3 seconds. */
  timeout?: number;
  /** Reporting is best-effort; failures are surfaced only through this callback. */
  onError?: (error: Error) => void;
}

export interface RegistryObservation {
  schemaVersion: 1;
  url: string;
  action: Exclude<TrapAction, "allow">;
  risk: number;
  trapTypes: TrapType[];
  detectorVersion: string;
  observedAt: string;
  surface: "text" | "html" | "image";
}

export interface RegistryReceipt {
  id: string;
  observations: number;
  status: "automated_observation";
}

const normalizePublicUrl = (raw: string): string | null => {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return null;
  url.search = "";
  url.hash = "";
  return url.toString();
};

const observationsEndpoint = (endpoint: string): string => {
  const url = new URL(endpoint);
  if (!url.pathname.endsWith("/api/observations")) {
    url.pathname = `${url.pathname.replace(/\/$/, "")}/api/observations`;
  }
  url.search = "";
  url.hash = "";
  return url.toString();
};

export function observationFromReport(
  report: InspectionReport,
  surface: RegistryObservation["surface"],
): RegistryObservation | null {
  if (report.action === "allow" || !report.url) return null;
  const url = normalizePublicUrl(report.url);
  if (!url) return null;
  return {
    schemaVersion: 1,
    url,
    action: report.action,
    risk: report.risk,
    trapTypes: [...new Set(report.findings.map((finding) => finding.type))],
    detectorVersion: report.meta.detectorVersion,
    observedAt: new Date().toISOString(),
    surface,
  };
}

export async function publishObservation(
  observation: RegistryObservation,
  options: RegistryOptions,
): Promise<RegistryReceipt> {
  const response = await fetch(observationsEndpoint(options.endpoint), {
    method: "POST",
    headers: {
      authorization: `Bearer ${options.apiKey}`,
      "content-type": "application/json",
      "user-agent": "@jev-traps/sdk",
    },
    body: JSON.stringify(observation),
    signal: AbortSignal.timeout(options.timeout ?? 3000),
    redirect: "error",
  });
  const body = (await response.json().catch(() => ({}))) as Partial<RegistryReceipt> & { error?: string };
  if (!response.ok) throw new Error(body.error ?? `Registry rejected observation (${response.status})`);
  if (typeof body.id !== "string" || typeof body.observations !== "number") {
    throw new Error("Registry returned an invalid receipt");
  }
  return { id: body.id, observations: body.observations, status: "automated_observation" };
}

export async function reportBestEffort(
  report: InspectionReport,
  surface: RegistryObservation["surface"],
  options?: RegistryOptions,
): Promise<void> {
  if (!options) return;
  const observation = observationFromReport(report, surface);
  if (!observation) return;
  try {
    await publishObservation(observation, options);
  } catch (error) {
    try { options.onError?.(error instanceof Error ? error : new Error("Registry reporting failed")); }
    catch { /* Optional reporting diagnostics must never break local protection. */ }
  }
}
