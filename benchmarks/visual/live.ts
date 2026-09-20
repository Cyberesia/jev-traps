import { readFile, writeFile } from "node:fs/promises";
import { inspectImage, createVisionAdapter } from "../../packages/vision/src/index.js";
const provider = process.env.VISION_PROVIDER;
if (!provider || !["anthropic", "openai", "openweights"].includes(provider) || !process.env.VISION_MODEL || !process.env.TYPESAFE_API_KEY) throw new Error("Set VISION_PROVIDER, VISION_MODEL and TYPESAFE_API_KEY explicitly. Live evaluation consumes provider credits.");
const adapter = createVisionAdapter({ provider: provider as "anthropic" | "openai" | "openweights", model: process.env.VISION_MODEL, apiKey: process.env[provider === "anthropic" ? "ANTHROPIC_API_KEY" : provider === "openai" ? "OPENAI_API_KEY" : "VISION_API_KEY"], baseURL: provider === "openweights" ? process.env.VISION_BASE_URL : undefined });
const corpus = JSON.parse(await readFile(new URL("./corpus.json", import.meta.url), "utf8"));
const results = [];
for (const item of corpus) {
 const report = await inspectImage({image:{bytes:await readFile(new URL(`./images/${item.id}.png`,import.meta.url)),mimeType:"image/png"},context:{source:item.surface,goal:"Summarize the incident status or page information accurately."}},{adapter});
 results.push({id:item.id,label:item.label,...report});
 console.log(`${item.id}: ${report.status} / ${report.action}`);
}
await writeFile(new URL("./live-results.json",import.meta.url),JSON.stringify({date:new Date().toISOString(),results},null,2));
if(results.some(x=>x.status!=="inspected"))process.exitCode=1;
