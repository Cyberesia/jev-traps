# @jev-traps/core

Offline static text/HTML inspection and deterministic policy.

```ts
import { inspectText } from "@jev-traps/core";
const report = inspectText("Untrusted text", { goal: "Summarize" });
```

ESM + TypeScript declarations. Node ≥22.15. Experimental; an allow result is not a safety guarantee. Raw findings may contain untrusted/private evidence.

[SDK reference](https://github.com/cyberesia/jev-traps/blob/main/docs/SDK.md) · [Vision guide](https://github.com/cyberesia/jev-traps/blob/main/docs/VISION.md) · [Security policy](https://github.com/cyberesia/jev-traps/blob/main/SECURITY.md).

Apache-2.0. Source: [cyberesia/jev-traps](https://github.com/cyberesia/jev-traps).
