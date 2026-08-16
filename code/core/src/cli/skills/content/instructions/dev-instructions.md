## UI Building and Story Writing Workflow

- Before creating or editing components or stories, call **{{GET_STORYBOOK_STORY_INSTRUCTIONS}}**; its output is the source of truth for imports, story patterns, and testing conventions.
- {{PREVIEW_STORIES_STEP}}
- {{FINAL_LINKS_STEP}}{{DISPLAY_REVIEW_STEP}}
- Only use story IDs returned by tools — never derive them from file names or memory. **{{GET_STORIES_BY_COMPONENT}}** maps any input to stories; its description covers the workflow. No matches means no stories exist yet — say so.
