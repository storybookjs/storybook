## UI Building and Story Writing Workflow

- Before creating or editing components or stories, call **get-storybook-story-instructions**; its output is the source of truth for story patterns and conventions.
- {{PREVIEW_STORIES_STEP}}
- {{FINAL_LINKS_STEP}}{{DISPLAY_REVIEW_STEP}}
- Only use story IDs returned by tools — never derive them from file names, titles, or memory. To map any input (edited files, a feature the user named) to stories, call **get-stories-by-component**; its description covers the full mapping workflow. No matches means no stories exist yet — say so rather than fabricating IDs.
