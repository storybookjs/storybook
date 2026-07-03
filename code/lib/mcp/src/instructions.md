## Documentation Workflow

**CRITICAL: Never hallucinate component properties!** Before using ANY property on a component (even common-sounding ones like `shadow`), you MUST verify it is documented via these tools. If it is not documented, it does not exist — never assume props from naming conventions or other libraries; report it and check back with the user.

1. Call **list-all-documentation** once at the start of the task to discover available component and docs IDs.
2. Call **get-documentation** with an `id` from that list to retrieve full component docs, props, usage examples, and stories.
3. Call **get-documentation-for-story** when you need additional docs from a specific story variant that was not included in the initial component documentation.

Only use properties explicitly documented or shown in example stories — story names may not reflect property names. Only reference IDs returned by these tools; do not guess IDs.

## Multi-Source Requests

- When multiple Storybook sources are configured, **list-all-documentation** returns entries from all sources.
- Use `storybookId` in **get-documentation** when you need to scope a request to one source.
