## Documentation Workflow

**CRITICAL: Never hallucinate component properties!** Undocumented props do not exist — never assume them from naming or other libraries; verify every prop via these tools, not source or types in node_modules.

1. Call **list-all-documentation** once at task start for component and docs IDs.
2. Call **get-documentation** with an `id` from that list for props and usage examples.

Only reference IDs returned by these tools — never guess; scope multi-source requests with `storybookId`.
