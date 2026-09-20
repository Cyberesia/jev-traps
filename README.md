# Jev Traps

**Inspect untrusted content before it becomes your agent’s next instruction.**

An Apache-2.0 TypeScript toolkit for text, HTML, browser content and experimental image inspection, plus a separate public evidence registry. Built for agents using Anthropic, OpenAI or open-weight models. The host enforces decisions; the agent does not get to skip the firewall.

**Status:** experimental, pre-release security tooling. npm publication is not assumed. The included registry is a clearly labeled synthetic demonstration, not a live threat feed. No detector guarantees safety, especially against adversarial visual perturbations.

## Start from source

Node.js ≥22.15 and pnpm 10.34.5:

```bash
git clone https://github.com/cyberesia/jev-traps.git
cd jev-traps
corepack enable
pnpm install --frozen-lockfile
pnpm test
pnpm benchmark
pnpm dev
# http://localhost:3043
```

The repository is prepared for `github.com/cyberesia/jev-traps`; the maintainer publishes it. Default tests and deterministic benchmarks make no paid API calls. Export API keys in your shell for CLI use; copying `.env.example` alone does not load them into arbitrary Node scripts.

## Packages

| Package | Responsibility | Network |
| --- | --- | --- |
| `@jev-traps/sdk` | Unified API and host enforcement helper | Only features you enable |
| `@jev-traps/core` | Static text/HTML inspection and deterministic policy | None |
| `@jev-traps/jev` | Atomic semantic questions through the official TypeSafe SDK | TypeSafe |
| `@jev-traps/playwright` | Computed DOM signals and conservative safe snapshots | Your browser; optional TypeSafe |
| `@jev-traps/vision` | Image adapters, normalized regions, semantic inspection | Selected vision endpoint, then TypeSafe |

Use these imports in a workspace consumer, or pack the packages locally until an npm release is available. See [release instructions](docs/RELEASING.md).

```ts
import { createTraps, requireAllowed } from "@jev-traps/sdk";

const traps = createTraps(); // offline static mode
const report = await traps.inspectText(toolOutput, {
  goal: "Summarize today's support incidents",
});
requireAllowed(report); // throws for sanitize, review and block
// Only now supply toolOutput as untrusted data to your agent.
```

For semantic inspection, export `TYPESAFE_API_KEY` server-side and use `createTraps({ semantic: true })`. Jev answers independent questions about agent direction, goal override, secret requests, tool manipulation, navigation, and benign quotation. Ordinary TypeScript determines actions and side effects. Scores are not calibrated probabilities.

Optional `registry` on `createTraps` lets server-side agents submit evidence-free private observations to the Registry site (`POST /api/observations`) after non-`allow` results on a public URL. Local enforcement is unchanged if reporting fails. See [SDK reference](docs/SDK.md) and [agent integrations](docs/INTEGRATIONS.md).

## Image and screenshot inspection

```ts
import { readFile } from "node:fs/promises";
import { createTraps, createVisionAdapter, requireAllowed } from "@jev-traps/sdk";

const traps = createTraps({
  vision: {
    adapter: createVisionAdapter({
      provider: "anthropic", // "openai" or "openweights" also supported
      model: process.env.VISION_MODEL!,
      apiKey: process.env.ANTHROPIC_API_KEY,
    }),
  },
});
const report = await traps.inspectImage({
  image: { bytes: await readFile("screen.png"), mimeType: "image/png" },
  context: { source: "slack", channel: "#support", goal: "Summarize incidents" },
});
requireAllowed(report);
```

The adapter inspects pixels and returns text **with visual context**, including low-visibility and non-text observations. Jev classifies those observations. Findings include normalized `region: { x, y, width, height }`, action and score. Metadata records the image hash, recipient endpoint, returned vision model, requested semantic model and semantic call count. Failed or incomplete inspection returns `review`, `risk: null`, and `releaseOriginal: false`.

This is a model-mediated inspection pipeline, not a proven defense against all multimodal attacks. Image descriptions and regions may be wrong. No built-in OCR engine, pixel sanitizer, PDF parser, Slack client, or email connector is claimed. Extract attachments in your application; render PDF pages in an isolated parser and inspect each page separately. [Vision contract and limitations →](docs/VISION.md)

## The registry is separate

- `/` — searchable synthetic evidence collection, with explicit demo labels.
- `/scan` — URL-first inspection through an isolated worker, with optional Jev analysis; local snippet tools remain available under developer tools.
- `/developers` — Anthropic, OpenAI and open-weight host integration examples and data-flow table.
- `/submit` — a private review queue for public URLs, not remote scanning or automatic publication.
- `GET /api/check?url=…` — advisory exact URL lookup, not a scan or a safety verdict.

The Next.js app dispatches URL inspections to the separate isolated worker; it does not fetch arbitrary user URLs itself. A feature flag alone cannot make a public scanner safe. An Internet-facing scan service requires an isolated worker, enforced egress, DNS-rebinding defenses, quotas and authenticated job orchestration. [Registry operations →](docs/REGISTRY.md)

## Local URL scan

```bash
pnpm --filter @jev-traps/playwright exec playwright install chromium
pnpm scan https://example.com
```

The CLI disables JavaScript and checks destinations, but is **not** a hardened public scan worker. Run it in a disposable environment without private network access. Raw local findings may contain untrusted or sensitive evidence; never publish CLI output automatically.

## Documentation

- [SDK reference](docs/SDK.md) · [Agent integrations](docs/INTEGRATIONS.md)
- [Vision and benchmark protocol](docs/VISION.md) · [Architecture](docs/ARCHITECTURE.md)
- [Registry operations](docs/REGISTRY.md) · [Release guide](docs/RELEASING.md)
- [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md) · [Changelog](CHANGELOG.md)

The 48-case synthetic static corpus is a regression test, not an efficacy certification. Vision mocks verify orchestration and fail-closed behavior, not model accuracy. Live benchmarks are explicit opt-in operations that consume provider credits; record model IDs, date and corpus revision before publishing results.

## License

[Apache-2.0](LICENSE). Contributions are accepted under the same license. This project is independent; naming an agent provider does not imply endorsement or certification.


## See Jev's decisions

The home page includes an interactive replay of **recorded synthetic evaluations**, not simulated live incidents. `/how-it-works` explains the atomic questions, risk policy, operator-triggered report triage and publication path. `/preventive` specifies a future bounded scanning program for sources agents actually use; it does not run a crawler.

`pnpm record:jev` intentionally performs six paid synthetic evaluations and refreshes `apps/registry/data/jev-recordings.json` with real model IDs, answers and timings. Inspect results before committing; this small sample is not an efficacy or production-performance benchmark.

The observatory consumes the real configured observations endpoint, with explicit empty/error/paused states. Agent ingestion is independent of public exposure: raw signals always remain private; only non-synthetic PR-reviewed records enter the public feed. No adopter counts are invented; the [opt-in directory](docs/AGENT-DIRECTORY.md) is maintained through reviewed references.

### Website URL scans

The `/scan` page accepts a public HTTPS page URL and uses the separately deployed isolated scan worker. Optional Jev analysis sends bounded excerpts to TypeSafe. See [URL scanning deployment](docs/URL-SCANNING.md). No local CLI is required for website visitors; live scanning stays unavailable until the worker, production quota and Turnstile are configured.
