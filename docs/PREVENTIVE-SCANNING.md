# Preventive inspection of agent-facing sources

Status: deployment design, not an active crawler. No third-party site is enrolled or fetched by opening the preventive page.

## Select sources by exposure

Start with a finite operator-approved list of public documentation, package READMEs, repositories, pages commonly retrieved by research agents and public support/knowledge sources. Prioritize known usage by your agents, meaningful content changes, stale verification and prior reproducible observations. Sensitive attachment sources require explicit authorization and private processing; use synthetic examples for public evidence.

A category like adult content is not a useful proxy for prompt-injection exposure. Conversely, ordinary documentation can carry untrusted instructions. A scan result is specific to content, timestamp and coverage, not a blanket verdict on a domain.

## Required worker boundary

Do not expose `scripts/scan-url.ts` through Next.js or a public scheduling endpoint. Before enabling a scheduled program:

1. Use a disposable worker/container without ambient credentials or private network routes; enforce egress at the network layer.
2. Resolve and bind public destinations at connection time; validate every redirect and defend against DNS rebinding. Restrict schemes, ports, requests, bytes, runtime, memory and browser capabilities.
3. Enroll only operator-approved sources. Queue jobs with bounded concurrency, per-origin budgets, total daily quotas and backoff. Never let an untrusted page or report grow the watchlist.
4. Hash fetched content and inspect meaningful changes. Keep explicit coverage for truncated DOM, image regions and failed attachment extraction. Inspect each new computer-use frame when relevant; a DOM pass does not cover pixels.
5. Record immutable content hash, model/version, detector/policy, observation time, latency and error state privately. Use atomic Jev classification before a deterministic decision. Do not conflate worker runtime with model-call latency.
6. Send findings into review. A public entry requires reproduction, redaction and a reviewed PR. Rechecks may establish removal; they do not establish attacker identity.

## Pilot exit criteria

Demonstrate network isolation and redirect/rebinding defenses in tests; show bounded queue behavior; include benign lookalikes; intentionally evaluate semantic/visual performance with exact model versions; verify redaction and deletion. Review operational costs and source permissions. Only then enable a small schedule, with alerts for meaningful changes rather than manufactured “live” activity.

The existing private inbox and optional agent-observation ingestion can receive reports from a future worker. They are not a worker, and an ingestion credential must not grant arbitrary fetching or public confirmation privileges.
