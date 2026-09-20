import { createHash } from "node:crypto";
import { inspectTextWithJev, type JevInspectOptions } from "@jev-traps/jev";
import type { InspectionReport, TrapAction } from "@jev-traps/core";
export { createVisionAdapter } from "./providers.js";

export interface Region { x: number; y: number; width: number; height: number }
export interface ImageInput { bytes: Uint8Array; mimeType: "image/png" | "image/jpeg" | "image/webp" }
export interface ImageContext { source?: string; channel?: string; url?: string; goal: string }
export interface VisualObservation {
  text: string;
  description: string;
  region: Region;
  visibility: "visible" | "low_visibility" | "non_text";
}
export interface VisionExtraction {
  observations: VisualObservation[];
  complete: boolean;
  model: string;
}
export interface VisionAdapter {
  provider: string;
  /** Exact destination receiving image bytes. No image URLs are fetched by this package. */
  destination: string;
  inspect(image: ImageInput, context: ImageContext): Promise<VisionExtraction>;
}
export interface VisualFinding {
  type: "visual_prompt_injection";
  region: Region;
  visibility: VisualObservation["visibility"];
  action: TrapAction;
  risk: number;
  findings: InspectionReport["findings"];
}
export interface ImageReport {
  action: TrapAction;
  risk: number | null;
  findings: VisualFinding[];
  status: "inspected" | "incomplete" | "failed";
  releaseOriginal: boolean;
  meta: {
    sha256: string;
    provider: string;
    destination: string;
    visionModel?: string;
    semanticModel: string;
    semanticCalls: number;
    returnedSemanticModels: string[];
    limitations: string[];
  };
}
export interface ImageInspectOptions {
  adapter: VisionAdapter;
  jev?: JevInspectOptions;
}
const ranks: Record<TrapAction, number> = { allow: 0, sanitize: 1, review: 2, block: 3 };

export function validateExtraction(value: unknown): VisionExtraction {
  const data = value as VisionExtraction;
  if (!data || typeof data.complete !== "boolean" || typeof data.model !== "string" || !data.model || !Array.isArray(data.observations) || data.observations.length > 24 || (data.complete && data.observations.length === 0)) throw new Error("Invalid vision response");
  for (const item of data.observations) {
    if (!item || typeof item.text !== "string" || typeof item.description !== "string" || !(item.text.trim() || item.description.trim()) || item.text.length + item.description.length > 6000 || !["visible", "low_visibility", "non_text"].includes(item.visibility)) throw new Error("Invalid observation");
    const r = item.region;
    if (!r || ![r.x, r.y, r.width, r.height].every(n => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1) || r.width === 0 || r.height === 0 || r.x + r.width > 1.000001 || r.y + r.height > 1.000001) throw new Error("Invalid normalized region");
  }
  return data;
}

/** Image analysis is probabilistic; review and failures never release the original. */
export async function inspectImage(input: { image: ImageInput; context: ImageContext }, options: ImageInspectOptions): Promise<ImageReport> {
  const { image, context } = input;
  if (!image.bytes.length || image.bytes.length > 5 * 1024 * 1024) throw new Error("Images must contain 1 byte to 5 MiB");
  if (!["image/png", "image/jpeg", "image/webp"].includes(image.mimeType)) throw new Error("Unsupported image type");
  if (!context.goal?.trim() || context.goal.length > 4000) throw new Error("A goal of 1–4000 characters is required");
  const report: ImageReport = {
    action: "review", risk: null, findings: [], status: "failed", releaseOriginal: false,
    meta: {
      sha256: createHash("sha256").update(image.bytes).digest("hex"),
      provider: options.adapter.provider, destination: options.adapter.destination,
      semanticModel: options.jev?.model ?? "jev-latest", semanticCalls: 0, returnedSemanticModels: [],
      limitations: ["Vision descriptions and regions are model estimates, not pixel-level guarantees.", "OCR and visual analysis can miss adversarial perturbations, tiny text and concealed instructions.", "No image redaction is performed; non-allow decisions withhold the entire image."],
    },
  };
  try {
    const extraction = validateExtraction(await options.adapter.inspect(image, context));
    report.meta.visionModel = extraction.model;
    report.status = extraction.complete ? "inspected" : "incomplete";
    report.action = extraction.complete ? "allow" : "review";
    report.risk = extraction.complete ? 0 : null;
    for (const observation of extraction.observations) {
      // Preserve spatial/visual context instead of classifying OCR text alone.
      const text = JSON.stringify({ untrusted_image_text: observation.text, untrusted_visual_description: observation.description, visibility: observation.visibility });
      report.meta.semanticCalls++;
      const result = await inspectTextWithJev(text, { ...options.jev, model: options.jev?.model ?? "jev-latest", goal: context.goal, onCall: event => {
        if (event.returnedModel && !report.meta.returnedSemanticModels.includes(event.returnedModel)) report.meta.returnedSemanticModels.push(event.returnedModel);
        options.jev?.onCall?.(event);
      } });
      if (result.findings.length) report.findings.push({ type: "visual_prompt_injection", region: observation.region, visibility: observation.visibility, action: result.action, risk: result.risk, findings: result.findings });
      if (ranks[result.action] > ranks[report.action]) report.action = result.action;
      if (report.risk !== null) report.risk = Math.max(report.risk, result.risk);
    }
    report.releaseOriginal = report.status === "inspected" && report.action === "allow";
  } catch {
    // Do not reflect provider errors: they may contain credentials or raw image content.
    report.status = "failed";
    report.action = report.action === "block" ? "block" : "review";
    report.risk = null;
    report.releaseOriginal = false;
  }
  return report;
}
