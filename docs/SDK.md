# SDK reference

All packages expose ESM and TypeScript declarations. Node ≥22.15 is the supported server runtime. `@jev-traps/core` can also run in browsers. Provider credentials belong only in server processes.

## Unified entrypoint

`createTraps({ semantic?, jev?, destination?, vision?, registry? })` from `@jev-traps/sdk` returns:

- `preflightUrl(url)` → `Promise<DestinationPreflight>`; never retrieves the destination.
- `inspectText(text, { goal?, url?, policy?, maxEvidenceLength? })` → `Promise<InspectionReport>`.
- `inspectHtml(html, options)` → `Promise<InspectionReport>`.
- `inspectImage({ image, context })` → `Promise<ImageReport>`; requires explicit `vision` configuration.

Default text/HTML mode is static and offline. Semantic mode forwards candidates and context to TypeSafe via `@typesafe-ai/sdk`. Vision has its own explicit configuration and always classifies extracted observations with Jev. Setting `semantic: false` does not disable the Jev stage of an explicitly configured image pipeline.

`requireAllowed(report)` throws unless `action === "allow"`. Place it in host middleware before adding content to a model conversation, regardless of the provider. Review and sanitize are not automatic permission to proceed.

## Destination preflight

Run preflight before browser navigation, retrieval tools or content scanning:

```ts
import { createTraps, SnapshotProvider, loadSnapshot } from "@jev-traps/sdk";

const traps = createTraps({
  destination: {
    provider: new SnapshotProvider(await loadSnapshot("/secure/urlhaus.json")),
    semantic: Boolean(process.env.TYPESAFE_API_KEY), // explicit URL/hostname disclosure
  },
});
const destination = await traps.preflightUrl(url);
if (destination.action !== "proceed") throw new Error(destination.reason);
```

The feed updater is intentionally a separate Node operation from runtime matching; import it from `@jev-traps/destination/urlhaus`. No feed data is bundled. A fresh exact active-URL match returns `stop`; stale/exact or hostname-only evidence returns `review`. Missing or expired intelligence never becomes a clean verdict. URL-level Jev is opt-in and asks independent questions about impersonation, credentials/funds, malware delivery, redirect concealment, hostname structure and benign explanations. Deterministic TypeScript maps those answers to `proceed`, `review` or `stop`.

```ts
import { refreshUrlhausSnapshot } from "@jev-traps/destination/urlhaus";
await refreshUrlhausSnapshot({
  authKey: process.env.URLHAUS_AUTH_KEY!,
  cachePath: "/secure/urlhaus.json",
});
```

Run refresh from a single trusted server-side scheduler no more often than the upstream export permits. The updater rejects redirects, malformed/tiny/rolled-back exports and retains the previous snapshot on failure. Feed credentials are never written to snapshot metadata. Feed data is not Apache-licensed by this repository; current upstream terms apply.

Destination results are not `InspectionReport`s and are never sent by automatic Registry observation reporting. The host owns navigation and any explicit override.

## Submit private observations

Configure `registry` to let protected agents submit minimal, unverified observations to the private Registry inbox:

```ts
const traps = createTraps({
  semantic: true,
  registry: {
    endpoint: "https://traps.example",
    apiKey: process.env.JEV_TRAPS_REGISTRY_KEY!,
    onError: (error) => logger.warn({ error }, "Registry reporting failed"),
  },
});

const report = await traps.inspectHtml(untrustedHtml, {
  url: "https://public.example/page",
});
requireAllowed(report);
```

For text and HTML, a configured SDK automatically reports non-`allow` results that have a public URL. Image observations are reported when `context.url` is provided. Reports contain only the normalized URL (query and fragment removed), action, risk, trap types, detector version, timestamp and surface. They never contain inspected text, HTML, image bytes, finding evidence, task goal or sanitized output.

Reporting is best-effort and never changes the local inspection result: an unavailable Registry cannot weaken or interrupt local protection. `allow` results and scans without a URL are never reported. Keep `JEV_TRAPS_REGISTRY_KEY` in the host process; never expose it to an agent prompt or browser bundle. `reportObservation()` is also available for explicitly constructed observations.

Automated observations are displayed separately from reviewed evidence. They do not establish compromise, attacker identity or safety, and are not an authoritative denylist.

## Reports

`InspectionReport` includes `action`, `risk` (0–1 heuristic), `findings`, optional `sanitized`, and detector counts. Findings have type, confidence, severity, reason, evidence and optional DOM location. Local evidence can contain raw untrusted content and secrets. Do not feed a raw report to an agent or publish it automatically.

Actions: `allow`, `sanitize`, `review`, `block`. Static signatures may surface a benign quoted attack for review; they should not by themselves block ordinary security documentation. The semantic layer asks independently interpretable questions, not a single “safe?” question.

`sanitized` from the static HTML helper is a best-effort string transform, **not an XSS sanitizer or a certificate that all instructions were removed**. Do not render it as trusted HTML. For non-allow text or images, the default integration withholds everything.

## Low-level entrypoints

- Core: `inspectText`, `inspectHtml`, `inspectTextStatic`, `inspectHtmlStatic`, `decideAction`, `sanitizeHtml`, `htmlToSafeText`.
- Destination: `canonicalizeDestination`, `SnapshotProvider`, `loadSnapshot`, `evaluateSnapshot`.
- Jev: `classifyWithJev`, `classifyDestinationWithJev`, `inspectTextWithJev`, `inspectHtmlWithJev`, `classifyHtmlCandidatesWithJev`.
- Playwright: `inspectPage`, `safeSnapshot`, `assertPageAllowed`.
- Vision: `inspectImage`, `createVisionAdapter`, `validateExtraction`.

Jev options: `apiKey`, injectable `client`, `model` (default requested alias `jev-latest`), `timeout`, `maxSemanticCandidates`, and optional `onCall` receiving requested/returned model identifiers without inspected content. Keep keys in `TYPESAFE_API_KEY`. No automatic model fallback occurs after a provider error. Text/HTML provider errors throw; image provider/classification errors withhold the image and return failed status.

`safeSnapshot()` uses the inspected HTML capture and withholds the entire page on any non-allow action. It does not return a raw page title. Its `findings` are for operator diagnostics, not model context. `assertPageAllowed()` is a legacy block-only helper; prefer `requireAllowed(await inspectPage(...))` if all non-allow actions must stop the agent.

## Costs and bounds

Text inspection performs one Jev call. HTML inspection considers up to eight candidates by default; it is not exhaustive DOM semantic coverage. Vision makes one adapter call and up to 24 Jev calls, one per extracted observation. Image inputs are at most 5 MiB; adapters time out after 30 seconds by default. Custom policy values are advanced configuration; validate changes against both attack and benign fixtures.

## Optional private report triage

`triageReportWithJev(note, { client?, apiKey?, model?, timeout? })` from `@jev-traps/jev` returns typed signals, a routing hint, model provenance, elapsed time and `requiresHumanReview: true`. It is separate from threat scoring and never publishes a record. Use it only on an operator-selected report authorized for TypeSafe processing. See [registry operations](REGISTRY.md).
