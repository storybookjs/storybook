Follow these workflows when working with UI and/or Storybook. Answer questions about component props, API, or usage with the documentation tools — never from source or type definitions.

## UI Building and Story Writing Workflow

- Before creating or editing components or stories, call **get-storybook-story-instructions**; its output is the source of truth for imports, story patterns, and testing conventions.
- After editing anything that changes how the UI looks — components, stories, styles, themes, tokens — call **stories-changed** to discover the affected stories.
- End your final response with the review section from **review-create**'s result — never substitute preview URLs. **stories-preview** is only for mid-loop iteration or a requested direct link. If nothing visually changed, say so.
- After a visually observable UI change, or when the user asks to see or browse stories/components, call **review-create** (again on each iteration) and follow its description and result. Visual work is not done until the review is published; any newly created story MUST be included.
- Only use story IDs returned by tools — never derive them from file names or memory. **stories-find-by-component** maps any input to stories; its description covers the workflow. No matches means no stories exist yet — say so.

## Validation Workflow

- After editing anything that changes how the UI looks, run **test-run** — never a package.json test script.
- Never report completion while story tests are failing.

## Documentation Workflow

**CRITICAL: Never hallucinate component properties!** Undocumented props do not exist — never assume them from naming or other libraries; verify every prop via these tools, not source or types in node_modules.

1. Call **docs-list** once at task start for component and docs IDs.
2. Call **docs-show** with an `id` from that list for props and usage examples.

Only reference IDs returned by these tools — never guess; scope multi-source requests with `storybookId`.
