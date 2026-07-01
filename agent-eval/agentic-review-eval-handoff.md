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

At least one eval should use `expect(transcript).toSatisfyCriterion(...)` or
`toScoreAtLeast(...)` to judge whether the review is meaningfully curated:

- important stories are included,
- unrelated stories are avoided,
- rationales explain why stories are relevant,
- collections are useful for visual review,
- the final surfaced review matches the user-facing format from the Notion spec.

## Verification

Run:

```sh
pnpm exec oxfmt --check $(git diff --name-only -- 'agent-eval/**/*.ts')
pnpm --dir agent-eval run typecheck
pnpm --dir agent-eval run eval:dry
```

Full eval execution is intentionally separate because it performs real agent/API runs.
