# @jev-traps/sdk

Unified entrypoint for text, HTML and experimental image inspection.

```ts
import { createTraps, requireAllowed } from "@jev-traps/sdk";
const report = await createTraps().inspectText("Untrusted text");
requireAllowed(report);
```

Before a retrieval tool contacts a destination, call `preflightUrl(url)`. Configure a local `SnapshotProvider` for maintained destination intelligence; optional URL-level Jev is a separate explicit opt-in. A `stop` or `review` result is enforced by your host—the SDK never navigates on its own.

```ts
const destination = await traps.preflightUrl(url);
if (destination.action !== "proceed") throw new Error(destination.reason);
```

To submit private evidence-free non-allow observations from protected agents, configure the optional server-side `registry` endpoint and ingestion key. The Registry remains optional and reporting failures never affect local enforcement. See the SDK reference for the data contract.

ESM + TypeScript declarations. Node ≥22.15. Experimental; an allow result is not a safety guarantee. Raw findings may contain untrusted/private evidence.

[SDK reference](https://github.com/cyberesia/jev-traps/blob/main/docs/SDK.md) · [Vision guide](https://github.com/cyberesia/jev-traps/blob/main/docs/VISION.md) · [Security policy](https://github.com/cyberesia/jev-traps/blob/main/SECURITY.md).

Apache-2.0. Source: [cyberesia/jev-traps](https://github.com/cyberesia/jev-traps).
