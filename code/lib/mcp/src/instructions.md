## Documentation Workflow

Never assume component props, variants, or API shape, and don't read a library's sources or types out of node_modules to learn a component — retrieve its documentation instead; never invent what isn't documented.

1. Call **list-all-documentation** once at the start of the task to discover component and docs IDs.
2. Call **get-documentation** with an `id` from that list for props and usage examples.
3. Call **get-documentation-for-story** for more examples from a specific story variant.

Only reference IDs returned by these tools — never guess IDs.
