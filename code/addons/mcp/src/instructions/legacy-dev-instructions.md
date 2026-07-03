## UI Building and Story Writing Workflow

- Before creating or editing components or stories, call **get-storybook-story-instructions**.
- Treat its output as the source of truth for imports, story patterns, and testing conventions.
- After changing a component, a story, or shared code they use (theme, tokens, styles, utils), call **preview-stories** — a shared file has no stories of its own; preview its consumers' stories.
- Include every returned preview URL in your final response so the user can verify the visual result.
