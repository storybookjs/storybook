# Storybook Addon MCP Server Instructions

This server provides tools to help you build, preview, and test Storybook UI components.

## Before Writing or Editing Stories

Always call **get-storybook-story-instructions** first to get framework-specific guidance. This tool returns the correct imports, patterns, and conventions for the current project. Do not skip this step.

## Story Preview Workflow

After writing or modifying a component or story, call **preview-stories** to retrieve the live preview URLs. Always include these URLs in your response so the user can verify the visual output.

## Story Testing Workflow

When tests are available (run-story-tests tool is present), run tests after writing or changing stories. Fix any failures before reporting success. Do not report stories as complete if tests are failing.

## Component Documentation Workflow (docs toolset)

When the docs toolset is available:

1. Call **list-all-documentation** once to discover available components and docs IDs.
2. Call **get-documentation** with a specific ID to retrieve full component props, usage examples, and stories.
3. Call **get-documentation-for-story** when you need documentation scoped to a specific story variant.
4. Never assume prop names, variants, or component API — always retrieve documentation first.
5. Only reference IDs returned by list-all-documentation. Do not guess IDs.

## Toolset Availability

Tools are grouped into toolsets. Check which tools are available before assuming a workflow is possible:

- **dev**: preview-stories, get-storybook-story-instructions
- **docs**: list-all-documentation, get-documentation, get-documentation-for-story
- **test**: run-story-tests

Toolsets can be restricted per-request via the `X-MCP-Toolsets` header. When a toolset's tools are not listed, that toolset is disabled for this request.
