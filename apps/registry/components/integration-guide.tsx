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
  return <><div className="tabs" role="group" aria-label="Agent provider">{labels.map(p=><button className={`pill ${p===provider ? "active" : ""}`} key={p} aria-pressed={p===provider} onClick={()=>setProvider(p)}>{p}</button>)}</div><pre className="code">{`import { createTraps, requireAllowed } from "@jev-traps/sdk";\n\nconst traps = createTraps({ semantic: true });\n// TYPESAFE_API_KEY lives on your server.\nconst report = await traps.inspectText(untrustedText, {\n  goal: "Summarize today's support incidents"\n});\nrequireAllowed(report); // throws on sanitize / review / block\n\n${returns[provider]}`}</pre><p className="note">Host middleware pattern, not a complete provider API client. The scan is mandatory in your code, not an optional tool the agent can skip. A successful scan does not make retrieved content trusted instructions.</p></>;
}
