# @storybook/addon-review

Renders an agent-pushed review of a code change inside Storybook.

This is the **base MCP-communication skeleton**: an ADE agent pushes a review
payload via the companion MCP server (`@storybook/addon-mcp`); the payload is
broadcast over the Storybook channel; this addon's page receives it (and
requests a replay on mount for late/refreshed tabs) and renders the raw state.

The page intentionally renders the data as-is — narrative, clusters, changed
files, diff hunks, per-story metadata. It is a foundation to build a real
review UI on, not the final experience.

## Channel contract

Event names live in `src/constants.ts` and are the cross-repo contract with
`@storybook/addon-mcp`. They must match the emitter's constants exactly.

- `…/display-review` — server → tabs: a new review overlay.
- `…/request-review` — tab → server: replay the cached overlay (on mount).

## Review state shape

See `src/review-state.ts`. It is a duplicate of the canonical valibot schema
that lives in the MCP addon; this side only renders, so it needs the type, not
the validator.
