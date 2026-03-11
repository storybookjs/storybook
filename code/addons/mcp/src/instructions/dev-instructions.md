## UI Building and Story Writing Workflow

- Before creating or editing components or stories, call **get-storybook-story-instructions**.
- Treat that tool's output as the source of truth for framework-specific imports, story patterns, and testing conventions.
- After changing any component or story, call **preview-stories**.
- Always include every returned preview URL in your user-facing response so the user can verify the visual result.
