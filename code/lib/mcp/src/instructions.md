## Documentation Workflow

1. Call **list-all-documentation** once at the start of the task to discover available component and docs IDs.
2. Call **get-documentation** with an `id` from that list to retrieve full component docs, props, usage examples, and stories.
3. Call **get-documentation-for-story** when you need additional docs from a specific story variant that was not included in the initial component documentation.

Use `withStoryIds: true` on **list-all-documentation** when you also need story IDs for inputs to other tools.

## Verification Rules

- Never assume component props, variants, or API shape. Retrieve documentation before using a component.
- If a component or prop is not documented, do not invent it. Report that it was not found.
- Only reference IDs returned by **list-all-documentation**. Do not guess IDs.

## Multi-Source Requests

- When multiple Storybook sources are configured, **list-all-documentation** returns entries from all sources.
- Use `storybookId` in **get-documentation** when you need to scope a request to one source.
