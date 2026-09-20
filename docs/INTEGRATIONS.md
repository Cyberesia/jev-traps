# Agent integrations and data flow

The agent's model and the detector's model are separate choices. Jev Traps does not automatically call Anthropic or OpenAI when an agent uses those providers. Your host calls the local SDK on retrieved content, then optionally calls your agent's provider.

```text
Tool / browser / attachment
  → preflight destination before navigation (optional local feed; optional URL-level Jev)
  → your host intercepts the result
  → Jev Traps: static code, optionally Jev; pixels via explicit vision adapter
  → deterministic action
  → allow: return content as untrusted tool data
  → sanitize / review / block: withhold original and resolve outside the agent
```

Use `examples/agents/guarded-tool.ts` as provider-independent middleware. Keep it mandatory; exposing an optional “scan” tool alone lets the agent skip the boundary. Never place tool output, OCR text or image instructions into system/developer messages. Scan errors must stop ingestion, not fall back to raw content.

After `requireAllowed`, serialize the allowed text into your provider's tool-result protocol:

| Agent | Tool result |
| --- | --- |
| Anthropic Messages | `{ type: "tool_result", tool_use_id, content }` inside a user message |
| OpenAI Responses | `{ type: "function_call_output", call_id, output }` |
| Open-weight chat-completions server | `{ role: "tool", tool_call_id, content }`, if supported |

These are integration patterns, not bundled agent clients. Tool invocation IDs come from the actual provider response. Your application still enforces permissions for tools and side effects.

## Network transparency

| Operation | Recipient | Payload | Paid calls |
| --- | --- | --- | --- |
| Static text / HTML | None | Stays in process | 0 |
| Local destination lookup | None | URL matched against an operator-managed local snapshot | 0 |
| Destination feed refresh | Configured feed operator | Authenticated export request; key remains in updater process | No detector call |
| Semantic destination assessment | TypeSafe | URL + hostname only; no fetched content | 1 |
| Semantic text | TypeSafe | Text, goal, URL if supplied, static signals | 1 |
| Semantic HTML | TypeSafe | Selected candidate contexts | Up to configured cap |
| Image | Configured vision endpoint, then TypeSafe | Image + context; then observation text + goal | 1 vision + up to 24 Jev |
| Registry check | Registry host | Queried public URL | No detector call |
| SDK automated observation | Registry host (`POST /api/observations`) | Normalized public URL, non-allow action, risk, trap types, detector version, surface, timestamp | No detector call; best-effort after local inspect |
| Community report (browser) | Registry host (`POST /api/submissions`) | Public URL + note | No detector call |

By default the SDK performs no Registry network I/O and no feed refresh. `preflightUrl()` uses only the provider supplied by the host; URL-level Jev runs only with `destination.semantic: true`. When you configure `registry` on `createTraps`, non-`allow` text/HTML results with a public URL, and image results with `context.url`, submit only the minimal observation envelope above to the private inbox. Destination-intelligence matches are never submitted automatically. Raw findings, goals, sanitized output and media bytes are never sent. Reporting failures do not change the local action. There is no hidden telemetry beyond what you explicitly configure (feed updater, Registry, TypeSafe, vision). Provider SDKs and services have their own data policies. Observation metadata is operational provenance, not a guarantee of detector accuracy or site compromise.
