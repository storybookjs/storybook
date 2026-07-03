## UI Building and Story Writing Workflow

- Before creating or editing components or stories, call **get-storybook-story-instructions**; its output is the source of truth for imports, story patterns, and testing conventions.
- {{PREVIEW_STORIES_STEP}}
- {{FINAL_LINKS_STEP}}{{DISPLAY_REVIEW_STEP}}
- Only use story IDs returned by tools — never derive them from file names, titles, or memory. **get-stories-by-component** maps any input (edited files, a feature name) to stories; its description covers the workflow. No matches means no stories exist yet — say so.
