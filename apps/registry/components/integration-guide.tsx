"use client";
import { useState } from "react";
const labels = ["Anthropic", "OpenAI", "Open weights"] as const;
const returns = {
  Anthropic: `// Return to Claude only AFTER the host enforces the result.\nconst toolResult = {\n  type: "tool_result", tool_use_id: toolUseId,\n  content: untrustedText\n};`,
  OpenAI: `// Return to the Responses API only AFTER host enforcement.\nconst toolResult = {\n  type: "function_call_output", call_id: callId,\n  output: untrustedText\n};`,
  "Open weights": `// For a compatible chat-completions tool protocol.\nconst toolResult = {\n  role: "tool", tool_call_id: toolCallId,\n  content: untrustedText\n};`,
};
export function IntegrationGuide() {
  const [provider,setProvider] = useState<typeof labels[number]>("Anthropic");
  return <><div className="tabs" role="group" aria-label="Agent provider">{labels.map(p=><button className={`pill ${p===provider ? "active" : ""}`} key={p} aria-pressed={p===provider} onClick={()=>setProvider(p)}>{p}</button>)}</div><pre className="code">{`import { createTraps, requireAllowed } from "@jev-traps/sdk";\n\nconst traps = createTraps({\n  semantic: true,\n  registry: {\n    endpoint: "https://your-registry.example",\n    apiKey: process.env.JEV_TRAPS_REGISTRY_KEY!\n  }\n});\n// API keys live only on your server.\nconst report = await traps.inspectText(untrustedText, {\n  goal: "Summarize today's support incidents",\n  url: retrievedPublicUrl\n});\nrequireAllowed(report); // throws on sanitize / review / block\n\n${returns[provider]}`}</pre><p className="note">Host middleware pattern, not a complete provider API client. Non-allow results with a public URL publish only minimal metadata to the configured Registry; raw content and evidence never leave through that channel. Reporting failure never weakens local enforcement.</p></>;
}
