# @storybook/addon-review

Renders an agent-pushed review of a code change inside Storybook.

An ADE agent pushes a review payload via the companion MCP server
(`@storybook/addon-mcp`); the dev server enriches it with the current git
branch, caches it, and broadcasts it over the Storybook channel. This addon's
page receives the payload (and requests a replay on mount so late or refreshed
tabs catch up) and renders it as a dedicated review experience:

- **Summary** — the review title and narrative, with the affected stories
  grouped into Collections (agent-curated clusters) or by Components, plus
  search and expand/collapse.
- **Details** — a focused, full-screen story preview with previous/next
  navigation through the reviewed stories and a link back to the summary.

## Channel contract

Event names live in `src/constants.ts` and are the cross-repo contract with
`@storybook/addon-mcp`. They must match the emitter's constants exactly.

- `…/push-review` — agent → server: a new review payload.
- `…/display-review` — server → tabs: broadcast a review (branch-enriched).
- `…/request-review` — tab → server: replay the cached review (on mount).

## Review state shape

See `src/review-state.ts`. It is a duplicate of the canonical valibot schema
that lives in the MCP addon; this side only renders, so it needs the type, not
the validator. The `branchName` field is resolved server-side and is not
trusted from the incoming agent payload.
