# Architecture and trust boundaries

```text
Your agent host                       Optional public registry
  text / HTML → core → policy           curated redacted evidence (git)
             ↘ Jev atomic questions    aggregated SDK observations (HTTPS)
  browser → Playwright → policy        private human report queue
  pixels → vision observations         browser-local scan lab
             → Jev → policy            no arbitrary URL fetching
  policy → host-enforced decision      advisory lookup only
             ↘ optional registry POST   never weakens local policy
```

`core` owns types, static signatures, risk aggregation and actions. It has no runtime dependencies or registry calls. `jev` uses the official `@typesafe-ai/sdk`: `TypeSafeClient`, `choice`, `noul`, `systemOne`. Its atomic questions describe agent direction, goal override, secrets, tool side effects, navigation, quotation and content role. The requested default model is `jev-latest`.

`vision` obtains structured pixel observations from a configured adapter, validates region bounds, and passes text plus visual context into the existing Jev classifier. It does not hand policy decisions to the vision model. The observer can itself be manipulated; this remains a model-mediated experimental defense. Non-text adversarial perturbations are not certified covered.

`sdk` composes these entrypoints. `requireAllowed` gives an explicit host boundary. Optional `registry` configuration submits evidence-free observations to the private Registry inbox over HTTPS; agents never talk to Postgres. `playwright` adds computed styles and a snapshot of the inspected HTML. All non-allow snapshots withhold the full page until selective removal can be verified reliably. Raw titles are not forwarded, and snapshot creation does not re-read mutable page content after inspection. Findings remain operator diagnostics.

The registry never determines whether the SDK allows content. Its bundled dataset is synthetic. SDK observations are aggregated signals, not reviewed evidence. Human curation separates community intake from curated public records. A public scan worker is deliberately not embedded in Next.js.

## Boundaries that remain the application's responsibility

- Sandboxing browsers, PDF renderers and image decoders; network egress restrictions.
- Tool authorization and permissions independent of content classification.
- Treatment of all retrieved content as data even after an allow result.
- Redaction before publishing; model/provider retention and budget controls.
- Runtime limits and full coverage across frames, attachments and long documents.

The static HTML sanitizer uses lightweight string transforms; it is not a general-purpose HTML security sanitizer. Strong XSS protection, exhaustive DOM parsing and comprehensive visual robustness are not claimed.

## Website URL scans

See [URL scanning](URL-SCANNING.md) for the URL-first website workflow and isolated service. `/api/scan` dispatches only to the configured authenticated worker. It does not fetch user URLs from Next.js or add results to the public registry.
