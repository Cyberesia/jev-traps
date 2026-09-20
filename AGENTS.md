# AGENTS.md — Jev Traps

This file is for Codex, Cursor, Claude Code and other coding agents working in this repository.

## Mission

Jev Traps is an open-source agent-content firewall plus a public evidence registry for web content designed to manipulate AI agents.

The repository has two distinct responsibilities:

1. Detection/neutralization packages (`packages/*`).
2. Public evidence registry (`apps/registry`).

Do not blur the two. Local detection must continue to work if the registry is offline, and the registry must never be treated as an authoritative denylist without local verification.

## Non-negotiable invariants

- Jev judges semantic questions. Deterministic code owns thresholds, actions and side effects.
- Never reduce the semantic layer to one question such as “is this safe?”. Keep atomic questions independently interpretable.
- Static signatures alone must not block quoted security research simply because it contains attack strings.
- `safeSnapshot()` must never include a node that policy marked for sanitization/blocking.
- Never publish unsanitized credentials, active malicious JavaScript, private URLs or complete exploit payloads in the Registry.
- Registry language describes evidence: observed/confirmed/removed/disputed. It does not infer attacker identity or declare a site hacked without separate evidence.
- Public scan endpoints are forbidden unless scanning runs in a hardened isolated worker with SSRF protections and egress restrictions.
- Tests must not consume TypeSafe credits by default.

## TypeSafe/Jev contract

Use the official `@typesafe-ai/sdk` package. Current integration uses:

```ts
import { TypeSafeClient, choice, noul } from "@typesafe-ai/sdk";
const client = new TypeSafeClient();
const result = await client.systemOne({ state, model: "jev-latest", questions });
```

The API key stays server-side in `TYPESAFE_API_KEY`.

## Before changing detection policy

1. Add or update attack fixtures.
2. Add at least one benign lookalike.
3. Run core tests.
4. Run the deterministic benchmark.
5. If changing semantic questions or thresholds, run the live benchmark intentionally and record the model/version.

## Product style

The Registry is intentionally editorial and restrained, inspired by the information density of MadeWithJev rather than copied from it. Prefer strong typography, whitespace, evidence tables and quiet status colors. Avoid dashboard clutter, gradients, fake cyber visuals and sensational “malicious site” language.
