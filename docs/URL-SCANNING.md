# Website URL inspection

Visitors use `/scan`: paste a public HTTPS URL, optionally enable Jev, then inspect the returned policy outcome, redacted finding descriptions and measured retrieval/analysis timings. No CLI, source HTML or visitor API key is required. Text/HTML pasting remains an optional developer tool. Reporting is a separate action and raw scan results never enter the public registry.

## Service boundary

Browser → Next `/api/scan` → authenticated isolated scan service → restricted egress gateway → public page. The scanner container has only an internal Docker network, a read-only filesystem, no Linux capabilities, bounded CPU/memory/process counts, two concurrent jobs and a fresh child process per job with a hard deadline. It cannot directly access the Internet. The gateway allows a fixed page-retrieval operation and a fixed TypeSafe System One operation; it is not a general HTTP proxy. An authenticated ingress route forwards scan jobs to the internal container.

Page retrieval accepts HTTPS public hostnames on port 443 only, resolves A records, rejects private/reserved addresses, and pins the validated address for the TLS connection while retaining the requested hostname for certificate verification and SNI. Every redirect is separately validated (maximum three). No cookies, authentication headers, JavaScript, images or subresources are loaded. Responses are limited to 256 KiB and HTML/plain text. Compressed responses and private/query/fragment-bearing redirects are rejected. IPv6-only sites are unsupported. Plain text is limited to 12,000 characters. Some sites block automated clients; failures yield no verdict.

Jev uses the official SDK and existing atomic questions/policy. HTML inspection sends at most three selected candidates (or a bounded fallback); this is not an exhaustive crawl. There are no provider retries. The gateway holds the TypeSafe credential; the inspection child receives only the gateway credential. Failure is never silently converted to a static-only successful result. The site never renders fetched HTML, raw findings or model payloads.

## Deploy before enabling the website form

Vercel hosts the Registry; these containers need a separate Docker-capable host. Vercel cannot execute Docker Compose. No scanner deployment is performed automatically by publishing the repository.

1. On the worker host, create a private environment file outside the repository with independently generated `SCAN_WORKER_KEY`, `EGRESS_KEY`, optional `TYPESAFE_API_KEY`, and `ENABLE_JEV=1` for semantic scans. Keep both service keys at least 32 random bytes.
2. From the repository root run:

   ```sh
   docker compose --env-file /secure/jev-scan.env -f apps/scan-worker/compose.yaml up -d --build
   ```

3. Terminate TLS on that host and reverse proxy **only `/scan`** to `127.0.0.1:9080`. The gateway's `/fetch` and `/v1/systemone` are for the internal scanner; do not expose them through the reverse proxy. Keep the published container port bound to loopback. Require the existing bearer authentication; do not strip or log Authorization. Configure request-rate limits at the ingress and Vercel, and disable request-body/URL logging. Never connect the scanner to an outbound Docker network.
4. Apply `apps/registry/db/migrations/004_scan_quota.sql` to Neon. This stores only a date and attempt count, no URL, IP, evidence or result. All attempts reserve quota atomically before worker dispatch; failed scans consume quota. Purge old counter rows periodically.
5. Set Vercel server variables `SCAN_WORKER_URL=https://<worker-host>/scan`, `SCAN_WORKER_KEY`, `REGISTRY_ENABLE_URL_SCAN=1`, `REGISTRY_SCAN_JEV=1` if the worker supports Jev, and `REGISTRY_SCAN_DAILY_CAP=100`. Configure `DATABASE_URL`, `TURNSTILE_SECRET_KEY` and build-time `NEXT_PUBLIC_TURNSTILE_SITE_KEY`. Redeploy after changing the public site key.
6. Test a benign public page in preview, both static and Jev modes, and confirm blocked/private URLs and quota/challenge failures. Then enable production. The form reports unavailable when required configuration is missing; it offers URL reporting instead of pretending a scan occurred.

The worker has no database or reporting credentials and writes no content logs. Hosting providers may retain network/access metadata; configure their retention independently. The URL is sent to the scan service, and the destination sees the gateway request. Enabling Jev explicitly sends page excerpts to TypeSafe. Do not submit sensitive or signed URLs. No automatic URL submission or publication occurs.

## Validation and limitations

Network-free tests cover address/URL rejection, redirect revalidation, TLS IP pinning, response format restrictions, safe output projection, benign content and provider errors. Tests do not measure real-world detection efficacy. The host's boundary protects the scanning service; the result does not make the inspected page trustworthy. JavaScript-rendered content, computed styles, authenticated pages, screenshots and image/PDF injections need the SDK's separate browser/vision path.

The UX is an original implementation informed by Unclutter's page-first inspection and explicit provider controls, and jev-ultrafast's narrow model-mediated operations. No code from those projects was copied.
