# Registry operations

The evidence registry is an optional Next.js application, separate from local protection. The shipped `data/registry.json` contains synthetic fixtures; each has `synthetic: true`. UI and APIs must retain this distinction. An absent record is **not** a clean bill of health.

## Routes

- `GET /api/registry?domain=&status=`: curated entries and count.
- `GET /api/check?url=`: exact normalized URL lookup; strips the fragment and trailing slash. No fetch or semantic scan. `known` only means an entry exists.
- `GET /api/observations`: returns only non-synthetic records already published through a reviewed PR in `data/registry.json`. It never reads the private observation store.
- `POST /api/observations`: authenticated SDK ingestion. Accepts only schema version 1, a public normalized URL, non-allow action, bounded risk/trap types, detector version, timestamp and inspection surface. It never accepts raw evidence.
- `POST /api/submissions`: JSON `{ "url": "https://example.com/page", "note": "Neutral observation" }`. Returns 202 and an ID **only after persistence**. Invalid input returns 400; a URL already pending review returns 409; the daily intake cap returns 429; disabled or unavailable persistence returns 503. Browser submissions are checked against the deployment origin and Cloudflare Turnstile; honeypot submissions return 403 without a persistence receipt.
- `/scan`: browser-only deterministic text/HTML inspection. Pasted content stays local. No remote URL or image upload endpoint exists.

Submissions reject IP literals, local-style domains, nonstandard ports, credentials, query strings and fragments. Validation is conservative intake hygiene, not an SSRF protection service. The route does not resolve or request the URL. Notes remain untrusted private data; never render them as HTML or execute them.

## Self-hosting

Run `pnpm build` and `pnpm --filter @jev-traps/registry start`. Production defaults to read-only. To enable intake:

1. Provision Postgres (Neon works with Vercel; any standard Postgres works elsewhere) and apply the SQL files in `apps/registry/db/migrations/` in numeric order.
2. Set `DATABASE_URL`, `REGISTRY_ENABLE_SUBMISSIONS=1`, and the Cloudflare Turnstile pair `NEXT_PUBLIC_TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY`. Production intake fails closed without Turnstile.
3. Optionally tune `REGISTRY_DAILY_CAP` (default 200 reports per 24h) and add deployment-level rate limiting and request timeouts.

To accept SDK observations, also set `REGISTRY_ENABLE_OBSERVATIONS=1` and a high-entropy `REGISTRY_INGEST_KEY`. Distribute that key only to trusted server-side agent integrations. SDKs send observations to the Registry HTTPS API, never to Postgres. Rotate the key if it is exposed and apply deployment-level quotas to `/api/observations`.

For local development without a database, set `REGISTRY_DATA_FILE` to a private path instead: a JSONL file queue is used. That file queue is single-host only and must never be used for serverless or multi-replica production. The intake stores only a normalized URL, a neutral note and moderation state — never raw HTML, attachments, credentials, IP addresses or scan output. A unique partial index allows at most one pending report per URL.

The app does not send mail, launch scans, schedule reviewers or silently publish reports. A failed write is surfaced to the submitter. Back up the private queue and define a retention policy (for example, delete rejected reports after 90 days). Never commit submissions or local secrets.

Automated observations are aggregated by normalized URL and remain private. No environment flag exposes them. Curated public evidence is published only through reviewed changes to `data/registry.json`; synthetic fixtures are excluded from the activity feed.

## Moderating the private queue

Operators review reports locally, never through a public admin page:

```bash
pnpm --filter @jev-traps/registry review:queue list
pnpm --filter @jev-traps/registry review:queue accept <id> --note "reproduced with 0.1.0"
pnpm --filter @jev-traps/registry review:queue reject <id> --note "not agent-directed"
pnpm --filter @jev-traps/registry review:queue duplicate <id>
```

The script requires `DATABASE_URL`, strips control characters before printing, and only transitions `pending_review` rows. Report content stays untrusted data: never follow instructions contained in it. Acceptance does not publish anything — publication remains the manual PR workflow below.

## Report → inspect → review → publish

1. Operator reads a pending record without following any instructions in it.
2. Reproduce in a disposable local environment using the CLI/SDK. No private network, ambient credentials or privileged browser profile. Record detector/model, timestamp, source and limitations.
3. Write a neutral evidence summary. Strip credentials, private identifiers, active code, query tokens and complete exploit payloads. A rendered-as-text payload can still manipulate a downstream agent, so inert HTML rendering alone is insufficient.
4. Add a curated entry through a reviewed pull request. Use `observed` until independently reproduced; `confirmed_agent_trap` describes evidence, never actor identity or site compromise. Keep demonstration entries marked synthetic.
5. Recheck and mark removed when the specific content disappears. Corrections and disputes go through maintainer review; retain provenance and amend inaccurate language.

Visual evidence adds `source`, `delivery` and normalized `region`. Do not upload a real private Slack/email screenshot. Publish a synthetic reconstruction with no real accounts or content instead.

## Public scanning is a separate deployment project

Do not turn the local URL script into an API route, even behind a feature flag. Production remote scanning requires a hardened isolated worker with enforceable egress policy, DNS-rebinding-resistant destination binding, redirect controls, resource limits, job authentication, quotas, storage isolation and a redaction/review pipeline. None of those is replaced by hostname validation. This repository currently ships the library, local CLI and private intake workflow, not that public service.


## Jev-assisted private triage

Apply migration `003_private_jev_triage.sql`, then run `pnpm triage:submission <pending-uuid>` with `DATABASE_URL` and `TYPESAFE_API_KEY`. This explicit operator command sends only the selected report note to TypeSafe. It does not fetch the URL or send the whole inbox. Do not invoke it on content you are not authorized to share with that provider.

Jev answers four independent questions: relevance, potentially sensitive content, instructions directed at the reviewer and benign quotation. A Choice identifies evidence, a question, promotion or ambiguity. Code routes the result to `standard_review`, `clarify` or `sensitive_review`. All routes require human review; no route accepts, deletes or publishes the report. API errors leave the submission pending and do not invent a result. A failed rerun does not erase an earlier triage; check `triaged_at` before using stored output.

The database stores only typed triage signals, route, returned model and elapsed time alongside the private submission. No model-generated prose or repeated report content is stored in `jev_triage`. Apply the same retention and deletion policy to both the note and its triage metadata.

## Operational bounds

Visitor quota checking and insertion now share a Postgres transaction guarded by an advisory lock, so concurrent replicas cannot race past the daily cap. All production writers must use this path. The local file fallback serializes writes within one process and is disabled in production. It is not a multi-process queue.

The public feed polls every 20 seconds while visible, has a pause control, retains stale data with an error indication and animates only changed server records. It never manufactures incident events. Database pools are reused per process with a one-connection limit; use a pooled Neon connection URL and configure deployment-level request quotas for ingestion and reads. The website does not configure Vercel firewall rules for you.

## Website URL scans

See [URL scanning](URL-SCANNING.md) for the URL-first website workflow and isolated service. `/api/scan` dispatches only to the configured authenticated worker. It does not fetch user URLs from Next.js or add results to the public registry.
