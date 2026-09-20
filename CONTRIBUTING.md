# Contributing

Contributions are welcome: attack fixtures and benign counterexamples, SDK adapters, reproducible bypass reports, accessibility fixes and evidence corrections. This project uses Apache-2.0 for code and contributions.

## Development

Use Node ≥22.15 and the pnpm version in `package.json`. Install with `pnpm install --frozen-lockfile`, then `pnpm dev`. The registry runs at localhost:3043. Build packages before running standalone examples.

Before a pull request:

```bash
pnpm test
pnpm typecheck
pnpm benchmark
pnpm benchmark:visual
pnpm --filter @jev-traps/registry build
```

Default tests do not use API keys or paid calls. A detection-policy change requires attack fixtures, at least one benign lookalike, core tests and deterministic benchmark. Semantic questions or thresholds additionally require intentional live evaluation, exact model provenance and disclosure of limitations. Never update expected labels just to make a test pass.

## Changes and review

Keep detection packages independent of the registry. Add concrete reproduction steps, expected/actual behavior and relevant validation to PRs. Separate corpus changes from claims about real domains. No automatic real-world accusation or publication of submissions. Provider adapters must explain what data leaves the process and must not fail open.

For images, contribute synthetic frames with benign and adversarial labels and normalized regions. Do not attach private messages or full real exploit payloads. Mock outputs verify contracts; real pixel evaluation needs a separately reported live run. The project does not claim complete adversarial visual robustness.

Report exploitable bugs through [private vulnerability reporting](https://github.com/cyberesia/jev-traps/security/advisories/new) once enabled. See [SECURITY.md](SECURITY.md). Discuss non-sensitive improvements in GitHub issues. Be respectful, factual and specific; maintainers may remove harassment, spam and private material.
