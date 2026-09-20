import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { createVisionAdapter, inspectImage, type ImageInput } from "../packages/vision/src/index.js";

const [file, goal] = process.argv.slice(2);
if (!file || !goal) throw new Error('Usage: pnpm scan:image ./screen.png "Summarize support incidents"');
const mimeTypes: Record<string, ImageInput["mimeType"]> = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" };
const mimeType = mimeTypes[extname(file).toLowerCase()];
if (!mimeType) throw new Error("Use a PNG, JPEG or WebP file");
const provider = process.env.VISION_PROVIDER;
if (!["openai", "anthropic", "openweights"].includes(provider ?? "") || !process.env.VISION_MODEL || !process.env.TYPESAFE_API_KEY) throw new Error("Set VISION_PROVIDER, VISION_MODEL, TYPESAFE_API_KEY and the selected provider credentials explicitly");
const adapter = createVisionAdapter({
  provider: provider as "openai" | "anthropic" | "openweights",
  model: process.env.VISION_MODEL,
  apiKey: process.env[provider === "anthropic" ? "ANTHROPIC_API_KEY" : provider === "openai" ? "OPENAI_API_KEY" : "VISION_API_KEY"],
  baseURL: provider === "openweights" ? process.env.VISION_BASE_URL : undefined,
});
const result = await inspectImage({ image: { bytes: await readFile(file), mimeType }, context: { source: "local-file", goal } }, { adapter });
console.log(JSON.stringify(result, null, 2));
if (result.action !== "allow") process.exitCode = 2;
