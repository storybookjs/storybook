# Agent eval suite — contributor rules

## Known failures: code comments, never tracking issues

When you relax or gate an eval assertion (`test.skip`, `test.skipIf(...)`,
narrowing a run condition), document it **only as a code comment directly
above that assertion**. Never create a GitHub issue for an eval failure and
never reference one from a gate comment — there is no issue-based
known-failure list (the old #317 tracker is retired).

The comment must be self-contained:

- the observed behavior (what the agent did instead),
- the evidence (CI run id and date),
- the condition for re-enabling.

Referencing a _causal_ change is fine (the PR that will fix the behavior, or
an upstream Storybook bug the assertion waits on) — that is a pointer to the
fix, not a tracker for the failure. See `evals/807-docs-request/EVAL.ts` and
`evals/808-shared-infra-fallback/EVAL.ts` for the expected shape, and the
"Known Failures" section in `README.md`.
