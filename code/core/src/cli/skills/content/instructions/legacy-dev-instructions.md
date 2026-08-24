## UI Building and Story Writing Workflow

- Before creating or editing components or stories, call **{{GET_STORYBOOK_STORY_INSTRUCTIONS}}**.
- Treat its output as the source of truth for imports, story patterns, and testing conventions.
- After editing anything that changes how the UI looks — components, stories, styles, themes, colors, design tokens — call **{{PREVIEW_STORIES}}**, no exceptions; a shared file has no stories of its own, so preview its consumers' stories.
- Include every returned preview URL in your final response.
