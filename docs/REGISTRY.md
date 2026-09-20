# Registry operations

The evidence registry is an optional Next.js application, separate from local protection. The shipped `data/registry.json` contains synthetic fixtures; each has `synthetic: true`. UI and APIs must retain this distinction. An absent record is **not** a clean bill of health.

## Routes

- `GET /api/registry?domain=&status=`: curated entries and count.
- `GET /api/check?url=`: exact normalized URL lookup; strips the fragment and trailing slash. No fetch or semantic scan. `known` only means an entry exists.
- `POST /api/submissions`: JSON `{ "url": "https://example.com/page", "note": "Neutral observation" }`. Returns 202 and an ID **only after persistence**. Invalid input returns 400; disabled or unavailable persistence returns 503.
- `/scan`: browser-only deterministic text/HTML inspection. Pasted content stays local. No remote URL or image upload endpoint exists.

Submissions reject IP literals, local-style domains, nonstandard ports, credentials, query strings and fragments. Validation is conservative intake hygiene, not an SSRF protection service. The route does not resolve or request the URL. Notes remain untrusted private data; never render them as HTML or execute them.

## Self-hosting

Run `pnpm build` and `pnpm --filter @jev-traps/registry start`. Production defaults to read-only. To enable intake, set `REGISTRY_ENABLE_SUBMISSIONS=1` and `REGISTRY_DATA_FILE` to a persistent private file path. Protect the endpoint with deployment-level quotas/rate limiting and request timeouts before accepting anonymous Internet submissions. The bounded JSONL queue is intended for a single-host installation; ephemeral/serverless filesystems and multiple replicas need a durable queue implementation.

The app does not send mail, launch scans, schedule reviewers or silently publish reports. A failed disk write is surfaced to the submitter. Back up the private queue and define your retention policy. Never commit submissions or local secrets.

## Report → inspect → review → publish

1. Operator reads a pending record without following any instructions in it.
2. Reproduce in a disposable local environment using the CLI/SDK. No private network, ambient credentials or privileged browser profile. Record detector/model, timestamp, source and limitations.
3. Write a neutral evidence summary. Strip credentials, private identifiers, active code, query tokens and complete exploit payloads. A rendered-as-text payload can still manipulate a downstream agent, so inert HTML rendering alone is insufficient.
4. Add a curated entry through a reviewed pull request. Use `observed` until independently reproduced; `confirmed_agent_trap` describes evidence, never actor identity or site compromise. Keep demonstration entries marked synthetic.
5. Recheck and mark removed when the specific content disappears. Corrections and disputes go through maintainer review; retain provenance and amend inaccurate language.

Visual evidence adds `source`, `delivery` and normalized `region`. Do not upload a real private Slack/email screenshot. Publish a synthetic reconstruction with no real accounts or content instead.

## Public scanning is a separate deployment project

Do not turn the local URL script into an API route, even behind a feature flag. Production remote scanning requires a hardened isolated worker with enforceable egress policy, DNS-rebinding-resistant destination binding, redirect controls, resource limits, job authentication, quotas, storage isolation and a redaction/review pipeline. None of those is replaced by hostname validation. This repository currently ships the library, local CLI and private intake workflow, not that public service.
