# @jev-traps/destination

Network-free destination matching and deterministic preflight policy for Jev Traps.

```ts
import { loadSnapshot, SnapshotProvider } from "@jev-traps/destination";

const provider = new SnapshotProvider(await loadSnapshot("/secure/urlhaus.json"));
const result = await provider.lookup("https://public.example/path");
if (result.action === "stop") {
  // Do not navigate or retrieve. Present result.reason to the operator.
}
```

The optional `@jev-traps/destination/urlhaus` entrypoint refreshes an authenticated URLhaus active export into an atomic local snapshot. It is Node-only, does not bundle feed data and is governed by the upstream provider’s current terms and fair-use policy. Runtime lookup performs no network I/O.

An exact fresh active-URL match can stop retrieval. Hostname-only or stale evidence requires review because shared hosting and cleanup can make whole-domain blocking inaccurate. An unavailable feed never means that a destination is safe.

External intelligence is not prompt-injection evidence and is never published to the Jev Traps Registry automatically.

Apache-2.0 source code. Third-party feed data retains its own terms.
