## Documentation Workflow

**CRITICAL: Never hallucinate component properties!** Before using ANY property on a component (even common-sounding ones like `shadow`), you MUST verify it is documented via these tools. If it is not documented, it does not exist — never assume props from naming conventions or other libraries; report it to the user instead.

1. Call **list-all-documentation** once at the start of the task to discover available component and docs IDs.
2. Call **get-documentation** with an `id` from that list to retrieve full component docs, props, usage examples, and stories.
3. Call **get-documentation-for-story** for extra docs on a story variant not covered by the component docs.

Only use properties explicitly documented or shown in example stories. Only reference IDs returned by these tools; never guess IDs.

## Multi-Source Requests

- With multiple sources configured, **list-all-documentation** returns entries from every source; pass `storybookId` to **get-documentation** to scope one.
