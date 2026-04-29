## UI Building and Story Writing Workflow

- Before creating or editing components or stories, call **get-storybook-story-instructions**.
- Treat that tool's output as the source of truth for framework-specific imports, story patterns, and testing conventions.
- Before and after changing UI, call **get-changed-stories** to discover new/modified/related stories.
- Then call **preview-stories** with selected `storyId` values from **get-changed-stories** to retrieve preview URLs.
- Always include every returned preview URL in your user-facing response so the user can verify the visual result.
