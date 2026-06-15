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
- `…/display-review` — server → tabs: broadcast a review (`createdAt`-stamped).
- `…/request-review` — tab → server: replay the cached review (on mount).

## Review state shape

See `src/review-state.ts`. It is a duplicate of the canonical valibot schema
that lives in the MCP addon; this side only renders, so it needs the type, not
the validator.

## Baseline comparison

The detail screen can render the reviewed story side-by-side against a baseline
Storybook. The baseline source is configured with a single environment variable:

```sh
STORYBOOK_REVIEW_BASELINE=...
```

It accepts either of:

- **A project-relative path to a static build** (e.g. `storybook-static`). The
  directory is served directly. Paths must stay inside the project — absolute
  paths and paths that escape the working directory via `..` are rejected.
- **A remote origin URL** (e.g. `https://my-app.chromatic.com`). Requests are
  proxied to that origin.

The dev server exposes the baseline under an internal proxy path, so baseline
previews and the baseline index load from the same origin as Storybook. If the
variable is unset, or is neither a valid relative path nor a valid URL, no
baseline is served (a warning is logged for invalid values) and the comparison
controls stay hidden.
