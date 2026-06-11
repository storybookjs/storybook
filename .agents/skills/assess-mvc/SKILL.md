---
name: assess-mvc
description: Assess a single PR against the six MVC criteria, or batch-process eligible open PRs. Use when a maintainer asks for an MVC check, when reviewing a community contribution before triage, or during the backlog-sweep testing phase.
allowed-tools: Bash
---

# Assess MVC

Wraps `scripts/sustainability/assess-mvc.ts`. The script returns a verdict
(PASS or FAIL), posts a tailored review (COMMENT or REQUEST_CHANGES), and
updates `mvc:*` labels.

## Environment

Both vars must be set:

- `GH_TOKEN` — fine-grained or classic PAT with: pull_requests:read+write,
  issues:read+write, contents:read, members:read (org). `gh auth token` works.
- `ANTHROPIC_API_KEY` — for the LLM-judged checks (Real problem, Cost/benefit,
  Explains how to test, Provides context) and the review-body synthesis.

## Single PR

When a maintainer or agent asks for an assessment of a specific PR. Skip
rules apply by default; pass `--force` to bypass them.

```bash
GH_TOKEN=$(gh auth token) ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" \
  node scripts/sustainability/assess-mvc.ts <PR_NUMBER>
```

Defaults are dry-run (no GitHub writes); add `--no-dry-run` to apply the
labels and submit the review. Run dry-run first when in doubt.

```bash
# Apply the verdict and submit the review.
node scripts/sustainability/assess-mvc.ts <PR_NUMBER> --no-dry-run

# Re-assess a PR that already has a verdict label (overrides the
# "already-assessed" skip rule).
node scripts/sustainability/assess-mvc.ts <PR_NUMBER> --no-dry-run --reassess

# Force-assess an ineligible PR (draft, maintainer-authored, or labeled
# mvc:skip). Bypasses skip rules entirely.
node scripts/sustainability/assess-mvc.ts <PR_NUMBER> --no-dry-run --force

# Wipe prior bot reviews before posting (keeps PR timelines clean).
node scripts/sustainability/assess-mvc.ts <PR_NUMBER> --no-dry-run --dismiss-previous
```

## Model and effort

The defaults (`sonnet-4.6` at `medium` effort) handle most PRs. Reach for
heavier models when a check returns uncertain or contested verdicts on a
spot-check:

```bash
node scripts/sustainability/assess-mvc.ts <PR> --model opus-4.6 --effort high
```

Choices: `sonnet-4.6` | `opus-4.6` | `haiku-4.5` · `low` | `medium` | `high` | `max`.

## Batch (testing-phase backlog sweep)

While the workflow's `pull_request_target` triggers are still commented out,
sweep the open backlog manually. The script's built-in skip rules handle
ineligible PRs (drafts, prior verdicts, maintainer-authored, `mvc:skip`) so
this is safe to run wide.

1. Find eligible PRs:

   ```bash
   gh search prs --repo storybookjs/storybook \
     'is:pr is:open draft:no -label:mvc:success -label:mvc:failed -label:mvc:skip' \
     --json number --jq '.[].number' --limit 200
   ```

2. For each, assess with writes enabled:

   ```bash
   for pr in $(gh search prs --repo storybookjs/storybook \
     'is:pr is:open draft:no -label:mvc:success -label:mvc:failed -label:mvc:skip' \
     --json number --jq '.[].number' --limit 200); do
     GH_TOKEN=$(gh auth token) ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" \
       node scripts/sustainability/assess-mvc.ts "$pr" --no-dry-run --dismiss-previous
   done
   ```

3. Collect any `Deferred:` outputs — those are PRs without an `agent-scan:*`
   label and will be retried automatically by the `mvc-assess` workflow once
   `agent-scan` labels them.

## Reading the output

clack renders progressive output. The key lines:

- After `Fetched`: PR URL, status, file count, labels, diff metrics, deps.
- After `Resolved N issue(s)`: each linked issue with its source(s) — `[api]`
  (GitHub's `closingIssuesReferences`), `[body]` (our body-text scan), or
  `[api+body]` when both flagged it.
- Each check inline with `✓` PASS, `✗` FAIL, `▲` WARN, `◐` DEFERRED.
- Final `Verdict: PASS` or `Verdict: FAIL (early-abort)`.

## Troubleshooting

- **Missing `GH_TOKEN`** → script exits 1 with the required-scopes list.
- **PR not in `storybookjs/`** → script exits 1; the URL must point at the org.
- **`Deferred: No agent-scan:* label yet`** → the `agent-scan` workflow hasn't
  labeled this PR yet. Retry once it does (the `mvc-assess` workflow listens
  for that label and re-runs automatically).
- **A specific check seems off** → re-run with `--model opus-4.6 --effort high`
  for that PR. If the verdict still looks wrong, capture the prompt with `-v`
  and report.

## What this script does NOT do

- Approve PRs. A separate phase-2 aggregator will APPROVE when both
  `mvc:success` and `verification:success` are present.
- Verify PR correctness (separate `verification:*` workflow).
- Complete PRs (add tests/stories/docs — separate finalization agent).
