# Validation record — 2026-09-20

## Offline checks

- `pnpm test`: 49 passing tests across core (3), Jev (2), Playwright (2), vision (10), SDK (8) and registry (24: intake + automated observations).
- `pnpm typecheck`: all workspace packages and the registry pass.
- `pnpm --filter @jev-traps/registry build`: production build succeeds; home, scan lab, developer guide, intake and four evidence pages generated.
- `pnpm benchmark`: 48 synthetic static cases. Candidate prefilter: TP 24 / FP 12 / TN 12 / FN 0. Actionable policy: TP 15 / FP 0 / TN 24 / FN 9. These are corpus regression results, not general efficacy estimates.
- Six synthetic visual PNGs rendered locally; `pnpm benchmark:visual` verifies the corpus contracts. Four attacks and two benign examples. No visual model accuracy measured by this command.
- Five npm tarballs packed and inspected: declarations, compiled ESM, README, license, repository metadata; workspace dependencies rewritten to versions; no environment files or private submissions.
- Frozen lockfile verification passes.

## Live Jev smoke benchmark

Command: `node --env-file=.env.local --import=tsx benchmarks/run-jev.ts --smoke`.

Requested alias: `jev-latest`. Returned model: **`jev-1.13.0`**. SDK: `@typesafe-ai/sdk` 0.6.0.

| Synthetic case | Expected | Result | Risk |
| --- | --- | --- | --- |
| ignore-prior | attack | block | 1.000 |
| security-doc | benign | allow | 0.418 |

Two cases are only a live API/behavior smoke check, not an accuracy benchmark. Existing semantic questions and policy thresholds were preserved. The full live corpus was not evaluated in this pass.

## Browser checks

The production preview was inspected at localhost:3044. Desktop and 390 px mobile layout checked. Registry visual-injection filter narrowed the collection to the image example. Scan lab returned BLOCK for the hidden synthetic attack and ALLOW for the security quotation. Pasted HTML is displayed as text, not executed.

## Unverified or deliberately absent

No image-provider key/model was configured, so no real Anthropic/OpenAI/open-weight vision run was performed. Provider request protocols, response validation, estimated regions, benign quotation behavior and failure handling were tested with mocks. Adversarial visual efficacy remains unvalidated.

No public URL scanning service, durable multi-host queue, reviewer authentication, automatic re-verification or PDF decoder is included. Public intake remains disabled by default in production. No GitHub push, npm publication or public deployment was performed.

## Jev explainability and private registry refinement — 2026-09-20

Validated in an isolated local copy of the current working tree before application:
- `pnpm test`: 58 passing tests (core 3, Jev 6, registry 28, Playwright 2, vision 10, SDK 9).
- `pnpm build` and `pnpm typecheck`: passed.
- `pnpm benchmark`: 48 deterministic cases; actionable static policy TP 15, FP 0, TN 24, FN 9. Static detection alone is incomplete.
- `pnpm benchmark:visual`: six fixture contracts (four attacks, two benign); this does not measure visual detection efficacy.
- Six intentional synthetic Jev calls recorded with returned model `jev-1.13.0`: text 820/733/472 ms; triage 263/300/364 ms. Three expected triage routes matched. Timings include network; these are examples, not a representative latency or accuracy benchmark.
- Browser QA: desktop layout, 390px mobile layout with no horizontal overflow, attack BLOCK and quoted-research ALLOW replay states, reviewed-feed empty state; no browser warning/error logs observed.

Raw agent observations stay private regardless of environment flags. The public activity API reads only non-synthetic PR-reviewed registry records. No production migration, Neon integration test, deployment, preventive crawl or GitHub push was performed in this pass. Apply migration 003 before using operator triage; configure deployment-level anti-abuse controls separately.

## URL-first website scanner — 2026-09-20

- Network-free suite: 69 tests passed (including seven isolated-worker transport/output tests and four scan-route tests). Build and typecheck passed.
- Docker image built from the lockfile; two-container service started locally. Scanner has an internal-only network, read-only filesystem, all capabilities dropped, 512 MiB memory and 64-process limit. A direct request from the scanner container to the public Internet failed as expected.
- Real public-page smoke: example.com, static mode, successful retrieval and verdict. Browser end-to-end static scan: 199 ms total in one run.
- One intentional Jev browser smoke on example.com: returned model jev-1.13.0, one call, 949 ms total (160 ms retrieval, 789 ms inspection). This single benign example measures neither accuracy nor representative latency.
- Browser QA: URL submission, pending state, results, explicit Jev opt-in, model provenance; desktop 1280px and mobile 390px with no horizontal overflow.
- No production deployment, live Turnstile/Neon integration test or migration was performed. Configure the isolated service and production dependencies described in URL-SCANNING.md before enabling the hosted form.
