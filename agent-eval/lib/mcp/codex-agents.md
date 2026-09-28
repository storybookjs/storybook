Follow these workflows when working with UI and/or Storybook. Answer questions about component props, API, or usage with the documentation tools — never from source or type definitions.

## UI Building and Story Writing Workflow

- Before creating or editing components or stories, call **get-storybook-story-instructions**.
- Treat its output as the source of truth for imports, story patterns, and testing conventions.
- After editing anything that changes how the UI looks — components, stories, styles, themes, colors, design tokens — call **stories-preview**, no exceptions; a shared file has no stories of its own, so preview its consumers' stories.
- Include every returned preview URL in your final response.

## Validation Workflow

- After editing anything that changes how the UI looks, run **test-run** — never a package.json test script.
- Use focused runs while iterating, then a broad pass before handoff when scope is unclear or wide.
- Fix failing tests; never report completion while they are failing.

## Documentation Workflow

**CRITICAL: Never hallucinate component properties!** Before using ANY property on a component (even common-sounding ones like `shadow`), you MUST verify it is documented via these tools. If it is not documented, it does not exist — never assume props from naming conventions or other libraries; report it to the user instead.

1. Call **docs-list** once at the start of the task to discover available component and docs IDs.
2. Call **docs-show** with an `id` from that list to retrieve full component docs, props, usage examples, and stories.
3. Call **docs-show-story** for extra docs on a story variant not covered by the component docs.

Only use properties explicitly documented or shown in example stories. Only reference IDs returned by these tools; never guess IDs.

## Multi-Source Requests

- With multiple sources configured, **docs-list** returns entries from every source; pass `storybookId` to **docs-show** to scope one.
