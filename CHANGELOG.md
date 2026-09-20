# Changelog

## Unreleased — 0.1.x open-source preparation

- Unified `@jev-traps/sdk` with explicit host enforcement.
- Experimental `@jev-traps/vision`: Anthropic/OpenAI/compatible open-weight adapters, visual context, normalized regions, bounded inputs and fail-closed incomplete/error behavior.
- Editorial dark registry UI, synthetic evidence labels, image evidence example, browser-local scan lab and provider/data-flow guide.
- Private submission queue returns errors on persistence failure; bounded bodies and conservative URL intake validation; production intake disabled by default.
- Conservative snapshots withhold non-allow pages, omit raw titles and reuse inspected HTML.
- `@jev-traps/destination` adds network-free destination matching, atomic URLhaus snapshot refresh, typed preflight actions and optional atomic Jev URL assessment before navigation.
- The isolated scan worker preflights initial URLs and every redirect before contact; Registry UI reports destination stops separately from content verdicts.
- Package READMEs/licenses/repository metadata, contributor and release documentation, offline contract tests and visual fixture benchmark scaffolding.

These changes do not certify multimodal, destination-reputation or prompt-injection efficacy. Enabling the public URL scanner still requires a separately deployed isolated worker, quotas, Turnstile and operator-managed provider credentials.
