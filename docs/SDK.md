# SDK reference

All packages expose ESM and TypeScript declarations. Node ≥22.15 is the supported server runtime. `@jev-traps/core` can also run in browsers. Provider credentials belong only in server processes.

## Unified entrypoint

`createTraps({ semantic?, jev?, vision? })` from `@jev-traps/sdk` returns:

- `inspectText(text, { goal?, url?, policy?, maxEvidenceLength? })` → `Promise<InspectionReport>`.
- `inspectHtml(html, options)` → `Promise<InspectionReport>`.
- `inspectImage({ image, context })` → `Promise<ImageReport>`; requires explicit `vision` configuration.

Default text/HTML mode is static and offline. Semantic mode forwards candidates and context to TypeSafe via `@typesafe-ai/sdk`. Vision has its own explicit configuration and always classifies extracted observations with Jev. Setting `semantic: false` does not disable the Jev stage of an explicitly configured image pipeline.

`requireAllowed(report)` throws unless `action === "allow"`. Place it in host middleware before adding content to a model conversation, regardless of the provider. Review and sanitize are not automatic permission to proceed.

## Reports

`InspectionReport` includes `action`, `risk` (0–1 heuristic), `findings`, optional `sanitized`, and detector counts. Findings have type, confidence, severity, reason, evidence and optional DOM location. Local evidence can contain raw untrusted content and secrets. Do not feed a raw report to an agent or publish it automatically.

Actions: `allow`, `sanitize`, `review`, `block`. Static signatures may surface a benign quoted attack for review; they should not by themselves block ordinary security documentation. The semantic layer asks independently interpretable questions, not a single “safe?” question.

`sanitized` from the static HTML helper is a best-effort string transform, **not an XSS sanitizer or a certificate that all instructions were removed**. Do not render it as trusted HTML. For non-allow text or images, the default integration withholds everything.

## Low-level entrypoints

- Core: `inspectText`, `inspectHtml`, `inspectTextStatic`, `inspectHtmlStatic`, `decideAction`, `sanitizeHtml`, `htmlToSafeText`.
- Jev: `classifyWithJev`, `inspectTextWithJev`, `inspectHtmlWithJev`, `classifyHtmlCandidatesWithJev`.
- Playwright: `inspectPage`, `safeSnapshot`, `assertPageAllowed`.
- Vision: `inspectImage`, `createVisionAdapter`, `validateExtraction`.

Jev options: `apiKey`, injectable `client`, `model` (default requested alias `jev-latest`), `timeout`, `maxSemanticCandidates`, and optional `onCall` receiving requested/returned model identifiers without inspected content. Keep keys in `TYPESAFE_API_KEY`. No automatic model fallback occurs after a provider error. Text/HTML provider errors throw; image provider/classification errors withhold the image and return failed status.

`safeSnapshot()` uses the inspected HTML capture and withholds the entire page on any non-allow action. It does not return a raw page title. Its `findings` are for operator diagnostics, not model context. `assertPageAllowed()` is a legacy block-only helper; prefer `requireAllowed(await inspectPage(...))` if all non-allow actions must stop the agent.

## Costs and bounds

Text inspection performs one Jev call. HTML inspection considers up to eight candidates by default; it is not exhaustive DOM semantic coverage. Vision makes one adapter call and up to 24 Jev calls, one per extracted observation. Image inputs are at most 5 MiB; adapters time out after 30 seconds by default. Custom policy values are advanced configuration; validate changes against both attack and benign fixtures.
