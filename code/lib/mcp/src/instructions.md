# Storybook MCP Server Instructions

This server provides access to Storybook component and documentation manifests.

## Tool Workflow

Use tools in this order:

1. **list-all-documentation** — Call once at the start of a task to discover available components and docs entries. Use the returned IDs for subsequent calls. Pass `withStoryIds: true` when you also need story IDs (e.g., for use with `preview-stories` or `get-documentation-for-story`) — this adds story sub-entries to the list.

2. **get-documentation** — Call with a specific `id` from the list to retrieve full component documentation including props, usage examples, and stories. Prefer this over re-calling list when you already know the ID.

3. **get-documentation-for-story** — Call with a story ID when you need documentation scoped to a specific story variant rather than the whole component.

## Anti-Hallucination Rules

- Never assume component props, variants, or API shape. Always retrieve documentation before using a component.
- If a component or prop is not in the documentation, do not invent it. Tell the user the component was not found.
- Only reference IDs returned by list-all-documentation. Do not guess IDs.

## Multi-Source Behavior

When multiple Storybook sources are configured, list-all-documentation returns entries from all sources. Use the `storybookId` field in get-documentation to scope requests to a specific source when needed.
