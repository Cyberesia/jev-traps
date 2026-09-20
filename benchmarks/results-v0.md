# V0 deterministic smoke benchmark

Executed locally during repository generation against the 48-case synthetic corpus in `benchmarks/corpus.jsonl`.

```text
Corpus: 48

Static candidate prefilter
TP 24  FP 12  TN 12  FN 0
precision 66.7%  recall 100.0%

Static actionable policy
TP 15  FP 0  TN 24  FN 9
precision 100.0%  recall 62.5%

Runtime ~15 ms total
```

## Interpretation

This is the intended V0 shape, not an accuracy claim:

- the **static prefilter is permissive** and surfaced all 24 synthetic attacks as semantic candidates;
- it also surfaced 12 benign lookalikes, including security/documentation language that should be disambiguated by Jev;
- the **static policy is conservative**: it took a non-`allow` action on 15 attacks and on none of the 24 benign samples;
- the remaining attacks are exactly the fuzzy cases the Jev layer is designed to classify.

This corpus is synthetic and tiny. A meaningful public benchmark should contain hundreds or thousands of independently reviewed samples and report static-only and live-Jev results separately.
