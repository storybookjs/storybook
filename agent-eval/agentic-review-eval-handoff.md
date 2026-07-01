# Agentic Review Eval Handoff

## Source Of Truth

The intended behavior is Yann's Notion spec:
https://app.notion.com/p/chromatic-ui/Agentic-Review-Eval-instructions-38e6e8162034804da78fdff2cb31ff24

Treat that document as the product contract. Current real-world deviations are calibration
context only and should not be encoded as expected behavior.

## Decisions

- Keep the existing `agent-eval` sidecar as the implementation surface.
- Add deterministic hard-floor assertions to existing visual-change evals where their
  fixture already exercises the review flow.
- Use an LLM judge in exactly one initial eval to prove the pattern for soft review
  quality. Do not make every eval depend on a judge yet.
- Add new eval fixtures only for behavior branches the current 901-915 corpus does not
  naturally cover.
- Port all old 901-915 eval fixtures into `agent-eval`; experiment configs should run
  the complete selected corpus for each agent/integration rather than a smoke subset.
- Keep known product/model failures out of ad hoc JSON allowlists. If a failure is
  intentionally not fixed, track it in the GitHub issue and document the relaxation
  immediately above the relevant assertion or shared assertion helper.
- Do not change MCP/plugin product code merely to make evals green. Fix harness,
  fixture, template, or assertion issues here; product bugs belong in the tracking
  issue unless they are explicitly in scope for this branch.

## Hard-Floor Acceptance Criteria

For visual code-change evals:

- `display-review` is called.
- The `display-review` payload has a non-empty title and description.
- Every collection has a non-empty title, rationale, and non-empty string `storyIds`.
- `changedFiles` is present and non-empty.
- The final assistant response ends with a dedicated review section and a review page
  link.
- The final assistant response does not also list individual story preview URLs.

For future branch-specific fixtures:

- Shared-infra changes exercise the `get-stories-by-component` fallback path.
- Non-visual refactors do not call `display-review`.
- Browse requests call `display-review` without `changedFiles`.

Concrete follow-up fixtures should stay deterministic and avoid adding more LLM judges:

- `916-shared-infra-visual-fallback`: prompt the agent to change shared UI
  infrastructure that affects multiple components without directly editing their stories.
  Assert that `get-stories-by-component` is used to discover affected stories and that
  `display-review` includes those story ids with `changedFiles`.
- `917-non-visual-refactor`: prompt a code-only refactor with no visually observable UI
  change. Assert that the agent performs the requested change and does not call
  `display-review`.
- `918-browse-existing-story`: prompt the agent to inspect an existing story without
  changing files. Assert that `display-review` is called for the browsed story and that
  the payload omits `changedFiles`.

## Soft Quality Criteria

Exactly one initial eval should use `expect(transcript).toSatisfyCriterion(...)` or
`toScoreAtLeast(...)` to judge whether the review is meaningfully curated:

- important stories are included,
- unrelated stories are avoided,
- rationales explain why stories are relevant,
- collections are useful for visual review,
- the final surfaced review matches the user-facing format from the Notion spec.

## Current Goal

Implement https://github.com/storybookjs/mcp/issues/315 and deliver it as PR #314.

- Implement this handoff artifact.
- Port the old 901-915 eval fixtures into `agent-eval` according to issue #315.
- Keep the `agent-eval` templates aligned with the fixtures: `preview.tsx`,
  default MSW support, static checks, and story test scripts.
- Run and pass `pnpm --dir agent-eval run typecheck`.
- Run and pass `pnpm --dir agent-eval run eval:dry`.
- Create or update the PR and get required CI green.
- Run the independent subagent `cursor-team-kit:thermo-nuclear-code-quality-review`
  review against issue #315 and this handoff.
- Run the independent Claude CLI review gate:

```sh
claude -p --model claude-opus-4-8 --effort max --agent thermo-nuclear-code-quality-review --tools default --dangerously-skip-permissions "Review the current PR diff against https://github.com/storybookjs/mcp/issues/315 with the thermo-nuclear-code-quality-review rubric. Use git to inspect the diff and changed files. Use the issue or handoff artifact as the source of intended behavior and acceptance criteria. Do not edit files. Report findings first with file/line references; if no issues are found, say so and name residual risks or test gaps."
```

- If either independent review reports actionable findings, fix or explicitly resolve
  them, then rerun both review gates against the latest PR diff.
- Resolve all human and automated review comments/threads.
- After CI is green and both review gates are clean, mark the PR ready if it is still
  a draft, request at least two appropriate reviewers, and explicitly ask Kasper for
  review.
- Complete only after CI is green, both review gates are clean, Kasper and at least
  one external human reviewer have approved, all review comments are resolved, and
  auto-merge is enabled.

## Verification

Run:

```sh
pnpm exec oxfmt --check $(git diff --name-only -- 'agent-eval/**/*.ts')
pnpm --dir agent-eval run typecheck
pnpm --dir agent-eval run eval:dry
```

Full eval execution is intentionally separate because it performs real agent/API runs.
