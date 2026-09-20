# Jev explainability and replay

The interactive decision lab replays `apps/registry/data/jev-recordings.json`. Every recorded text case is produced by `inspectTextWithJev`, with a client wrapper capturing the actual TypeSafe answers. The UI shows six Noul judgments, the Choice role, the resulting core policy score/action and model ID. It does not reimplement risk aggregation or infer safety from an average of the bars.

`pnpm record:jev` performs three synthetic content inspections plus three synthetic private-triage cases. API keys are server-side. Only fictional fixture text is sent; no submission, private URL or real attachment is read. The result file includes wall-clock durations (client and network included). Do not interpret six samples as a throughput benchmark, calibrated probability study, security certification or comparison with another provider.

Replay is manually started, pausable and step-selectable; CSS honors reduced-motion preferences. Replay animation time is separate from recorded processing duration. The live observatory, by contrast, polls the actual API and never cycles synthetic cases as new incidents. Missing data and unavailable connections remain visible states.

## Inspiration and attribution

The interaction is an original implementation inspired by the activity-feed concept referenced in [OSSInsight](https://github.com/pingcap/ossinsight). The exact linked historical source could not be retrieved during this pass; no code from it was copied. Related Jev projects illustrate narrow typed judgments and host-owned enforcement: [jev-mcp](https://github.com/burnigtm/jev-mcp), [pi-heed](https://github.com/Nyarlathoteppppp/pi-heed), [tax-doc-classifier](https://github.com/kyotofin/tax-doc-classifier). These are ecosystem references, not claimed adopters.
