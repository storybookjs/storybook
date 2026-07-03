## Documentation Workflow

**CRITICAL: Never hallucinate component properties!** Undocumented props do not exist — never assume them from naming or other libraries, never read a component's types out of node_modules; retrieve its documentation instead.

1. Call **list-all-documentation** once at task start to discover component and docs IDs.
2. Call **get-documentation** with an `id` from that list for props and usage examples.
3. Call **get-documentation-for-story** for more examples from a specific story variant.

Only reference IDs returned by these tools — never guess; scope multi-source requests with `storybookId`.
