import { inspectHtml, inspectText, type InspectOptions, type InspectionReport } from "@jev-traps/core";
import { inspectHtmlWithJev, inspectTextWithJev, type JevInspectOptions } from "@jev-traps/jev";
import { inspectImage, type ImageInput, type ImageContext, type ImageInspectOptions } from "@jev-traps/vision";
export * from "@jev-traps/core";
export { createVisionAdapter } from "@jev-traps/vision";
export type { ImageReport, ImageInput, ImageContext, Region } from "@jev-traps/vision";

/** All decisions execute in the host, independent of the agent's model provider. */
export function createTraps(options: { semantic?: boolean; jev?: JevInspectOptions; vision?: ImageInspectOptions } = {}) {
  return {
    inspectText: (text: string, context: InspectOptions = {}): Promise<InspectionReport> => options.semantic
      ? inspectTextWithJev(text, { ...options.jev, ...context }) : Promise.resolve(inspectText(text, context)),
    inspectHtml: (html: string, context: InspectOptions = {}): Promise<InspectionReport> => options.semantic
      ? inspectHtmlWithJev(html, { ...options.jev, ...context }) : Promise.resolve(inspectHtml(html, context)),
    inspectImage: (input: { image: ImageInput; context: ImageContext }) => {
      if (!options.vision) throw new Error("Configure a vision adapter explicitly before sending images");
      return inspectImage(input, options.vision);
    },
  };
}

/** Safe default for agent tool middleware: only allow advances automatically. */
export function requireAllowed(report: { action: string }): void {
  if (report.action !== "allow") throw new Error(`Jev Traps withheld content: ${report.action}`);
}
