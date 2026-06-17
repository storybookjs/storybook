---
name: sustainability-assess-mvc
description: Check if a single PR, or all eligible open PRs, is a Minimum Viable Contribution, worthy of human reviewer time. Use to review new community contributions and tell authors how to make their PR viable; or when a maintainer asks to reassess MVC status on a PR.
allowed-tools: Bash
---

# Assess Minimum Viable Contribution (MVC)

Wraps `scripts/sustainability/assess-mvc.ts`. The script returns a verdict
(Deferred, PASS or FAIL), posts a tailored review (COMMENT or REQUEST_CHANGES), and
updates `mvc:*` labels.

## Environment

Both vars must be set:

- `GH_TOKEN` — fine-grained or classic PAT with: pull_requests:read+write,
  issues:read+write, contents:read, members:read (org). `gh auth token` works.
- `ANTHROPIC_API_KEY` — for the LLM-judged checks (Real problem, Cost/benefit,
  Explains how to test, Provides context) and the review-body synthesis.

## Single PR

When a maintainer or agent asks for an assessment of a specific PR.

```bash
GH_TOKEN=$(gh auth token) ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" \
  node scripts/sustainability/assess-mvc.ts <PR_NUMBER>
```

Defaults are dry-run (no GitHub writes); add `--no-dry-run` to apply the
labels and submit the review. Run dry-run first unless explicitly told otherwise.

Skip rules apply by default; pass `--force` and `--reassess` to bypass them.

```bash
# Safely output an assessment verdict to console.
node scripts/sustainability/assess-mvc.ts <PR_NUMBER> --dry-run

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

Scan open PRs or use user input to determine which PRs to assess.
The script's built-in skip rules handle ineligible PRs (drafts, prior verdicts,
maintainer-authored, `mvc:skip`) so this is safe to run wide.

1. Find eligible PRs, and for each, call the assessment script:

   ```bash
   for pr in $(gh search prs --repo storybookjs/storybook \
     'is:pr is:open draft:no -label:mvc:success -label:mvc:failed -label:mvc:skip' \
     --json number --jq '.[].number' --limit 200); do
     GH_TOKEN=$(gh auth token) ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" \
       node scripts/sustainability/assess-mvc.ts "$pr"
   done
   ```

2. Collect `Pass`, `Fail` and `Deferred` outputs and present them to the user.

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
  labeled this PR yet. Retry once it has (the `mvc-assess` workflow listens
  for that label and re-runs automatically), or trigger it yourself.
- **A specific check seems off** → re-run with `--model opus-4.6 --effort high`
  for that PR. If the verdict still looks wrong, capture the prompt with `-v`
  and report.

## What this script does NOT do

- Approve PRs; this is the maintainers' job.
- Verify PR correctness (separate verification agent).
- Complete PRs (add tests/stories/docs; separate finalization agent).
