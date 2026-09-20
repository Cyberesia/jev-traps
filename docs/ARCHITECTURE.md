# Architecture and trust boundaries

```text
Your agent host
  URL → local destination snapshot → optional Jev URL questions
      → host-enforced proceed / review / stop
  permitted retrieval → text / HTML → core + optional Jev → policy
                      → browser → Playwright → policy
                      → pixels → vision observations → Jev → policy
  non-allow content → optional evidence-free Registry POST

Registry deployment
  curated redacted evidence (git) + private intake/observations
  browser → Next /api/scan → authenticated isolated worker → restricted egress
  Registry evidence never weakens or replaces local policy
```

`core` owns content types, static signatures, risk aggregation and actions. It has no runtime dependencies or registry calls. `destination` owns conservative URL canonicalization, immutable local snapshots and deterministic preflight actions; lookup is network-free. Its optional Node updater is the only component that downloads a configured feed. `jev` uses the official `@typesafe-ai/sdk`: `TypeSafeClient`, `choice`, `noul`, `systemOne`. Separate atomic question sets cover content manipulation and URL-level destination signals. The requested default model is `jev-latest`.

`vision` obtains structured pixel observations from a configured adapter, validates region bounds, and passes text plus visual context into the existing Jev classifier. It does not hand policy decisions to the vision model. The observer can itself be manipulated; this remains a model-mediated experimental defense. Non-text adversarial perturbations are not certified covered.

`sdk` composes these entrypoints. `preflightUrl` runs before host navigation and never retrieves a destination. `requireAllowed` gives an explicit content boundary. Optional `registry` configuration submits evidence-free content observations to the private Registry inbox over HTTPS; destination feed matches are excluded and agents never talk to Postgres. `playwright` adds computed styles and a snapshot of the inspected HTML. All non-allow snapshots withhold the full page until selective removal can be verified reliably. Raw titles are not forwarded, and snapshot creation does not re-read mutable page content after inspection. Findings remain operator diagnostics.

The registry never determines whether the SDK allows content or a destination. Its bundled dataset is synthetic. External threat intelligence is time-bound third-party evidence, not a Registry record or authoritative statement about an owner. SDK observations are aggregated signals, not reviewed evidence. Human curation separates community intake from curated public records. The public scan worker remains separate from Next.js.

## Boundaries that remain the application's responsibility

- Sandboxing browsers, PDF renderers and image decoders; network egress restrictions.
- Tool authorization and permissions independent of content classification.
- Treatment of all retrieved content as data even after an allow result.
- Redaction before publishing; model/provider retention and budget controls.
- Runtime limits and full coverage across frames, attachments and long documents.

The static HTML sanitizer uses lightweight string transforms; it is not a general-purpose HTML security sanitizer. Strong XSS protection, exhaustive DOM parsing and comprehensive visual robustness are not claimed.

## Website URL scans

See [URL scanning](URL-SCANNING.md) for the destination-preflight and URL-first website workflow. The egress service maintains the optional feed snapshot, checks the initial URL and every redirect before contact, and keeps provider credentials outside the scanner child. `/api/scan` dispatches only to the configured authenticated worker. It does not fetch user URLs from Next.js or add results to the public registry.
