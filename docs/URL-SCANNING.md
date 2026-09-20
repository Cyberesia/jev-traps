# Website URL inspection

Visitors use `/scan`: paste a public HTTPS URL, run destination preflight, optionally enable URL-level Jev, then retrieve permitted pages for static and optional Jev content inspection. A stopped destination returns a typed warning and no content verdict. No CLI, source HTML or visitor API key is required. Text/HTML pasting remains an optional developer tool. Reporting is a separate action and preflight/scan results never enter the public registry.

## Service boundary

Browser → Next `/api/scan` → authenticated isolated scan service → restricted egress gateway → public page. The scanner container has only an internal Docker network, a read-only filesystem, no Linux capabilities, bounded CPU/memory/process counts, two concurrent jobs and a fresh child process per job with a hard deadline. It cannot directly access the Internet. The gateway allows fixed destination-preflight, page-retrieval and TypeSafe System One operations; it is not a general HTTP proxy. An authenticated ingress route forwards scan jobs to the internal container.

Before retrieval, the gateway matches the exact URL against its local immutable destination-intelligence snapshot. A fresh/degraded exact URL still marked online stops retrieval. Hostname-only, stale or offline evidence is review-only because a hostname can be shared or cleaned. Redirect targets are preflighted before contact. Missing, corrupt or expired intelligence is reported as unavailable/expired rather than “clean” and does not disable existing content inspection.

Page retrieval accepts HTTPS public hostnames on port 443 only, resolves A records, rejects private/reserved addresses, and pins the validated address for the TLS connection while retaining the requested hostname for certificate verification and SNI. Every redirect is separately validated (maximum three). No cookies, authentication headers, JavaScript, images or subresources are loaded. Responses are limited to 256 KiB and HTML/plain text. Compressed responses and private/query/fragment-bearing redirects are rejected. IPv6-only sites are unsupported. Plain text is limited to 12,000 characters. Some sites block automated clients; failures yield no verdict.

URL-level Jev is a separate explicit opt-in and sends only the URL and hostname to TypeSafe. It asks independent questions about impersonation, credentials/funds, malware delivery, redirect concealment, hostname structure and plausible benign purpose; deterministic code owns `proceed/review/stop`. Content Jev uses the existing atomic questions/policy and sends at most three selected HTML candidates (or a bounded fallback). There are no provider retries. The gateway holds TypeSafe and feed credentials; the inspection child receives only the gateway credential. Requested provider failures never silently become successful verdicts. The site never renders fetched HTML, raw findings or model payloads.

## Deploy before enabling the website form

Vercel hosts the Registry; these containers need a separate Docker-capable host. Vercel cannot execute Docker Compose. No scanner deployment is performed automatically by publishing the repository.

1. On the worker host, create a private environment file outside the repository with independently generated `SCAN_WORKER_KEY`, `EGRESS_KEY`, optional `TYPESAFE_API_KEY`, `ENABLE_JEV=1` for content semantics and `ENABLE_DESTINATION_JEV=1` for URL-level semantics. Keep both service keys at least 32 random bytes.
   - To enable URLhaus intelligence, obtain an Auth-Key from `auth.abuse.ch` and set `URLHAUS_AUTH_KEY`. The adapter requests the official active CSV export no more often than every five minutes (default ten minutes with jitter), validates it and stores only a `0600` atomic snapshot in the Docker cache volume.
   - URLhaus covers malware-distribution URLs, not all phishing, scams or agent traps. Its current fair-use/ commercial terms apply to feed consumption; no feed data is bundled or redistributed by this repository.
2. From the repository root run:

   ```sh
   docker compose --env-file /secure/jev-scan.env -f apps/scan-worker/compose.yaml up -d --build
   ```

3. Terminate TLS on that host and reverse proxy **only `/scan`** to `127.0.0.1:9080`. The gateway's `/fetch` and `/v1/systemone` are for the internal scanner; do not expose them through the reverse proxy. Keep the published container port bound to loopback. Require the existing bearer authentication; do not strip or log Authorization. Configure request-rate limits at the ingress and Vercel, and disable request-body/URL logging. Never connect the scanner to an outbound Docker network.
4. Apply `apps/registry/db/migrations/004_scan_quota.sql` to Neon. This stores only a date and attempt count, no URL, IP, evidence or result. All attempts reserve quota atomically before worker dispatch; failed scans consume quota. Purge old counter rows periodically.
5. Set Vercel server variables `SCAN_WORKER_URL=https://<worker-host>/scan`, `SCAN_WORKER_KEY`, `REGISTRY_ENABLE_URL_SCAN=1`, `REGISTRY_SCAN_JEV=1` if content Jev is available, `REGISTRY_SCAN_DESTINATION_JEV=1` if URL-level Jev is available, and `REGISTRY_SCAN_DAILY_CAP=100`. Configure `DATABASE_URL`, `TURNSTILE_SECRET_KEY` and build-time `NEXT_PUBLIC_TURNSTILE_SITE_KEY`. Redeploy after changing the public site key.
6. Test a benign public page in preview, both static and Jev modes, and confirm blocked/private URLs and quota/challenge failures. Then enable production. The form reports unavailable when required configuration is missing; it offers URL reporting instead of pretending a scan occurred.

The worker has no database or reporting credentials and writes no content logs. Hosting providers may retain network/access metadata; configure their retention independently. The URL is sent to the scan service. If preflight permits retrieval, the destination sees the gateway request. URL-level Jev sends the URL/hostname; content Jev sends selected excerpts. Do not submit sensitive or signed URLs. No automatic feed submission, Registry submission or publication occurs.

## Validation and limitations

Network-free tests cover feed parsing/canonicalization/freshness, last-known-good cache behavior, initial and redirect preflight, shared-hosting lookalikes, address/URL rejection, redirect revalidation, TLS IP pinning, response format restrictions, safe output projection, benign content and provider errors. Tests do not measure real-world detection efficacy. The host's boundary protects the scanning service; the result does not make the inspected page trustworthy. JavaScript-rendered content, computed styles, authenticated pages, screenshots and image/PDF injections need the SDK's separate browser/vision path.

The UX is an original implementation informed by Unclutter's page-first inspection and explicit provider controls, and jev-ultrafast's narrow model-mediated operations. No code from those projects was copied.
