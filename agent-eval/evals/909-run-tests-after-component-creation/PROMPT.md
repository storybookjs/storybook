Create a new `StatusPill` UI component and Storybook stories.

Before writing stories, call the Storybook MCP tool `get-storybook-story-instructions` and follow its guidance.

Requirements:

1. The component MUST support these props:
   - `label: string`
   - `tone?: 'neutral' | 'success' | 'warning' | 'critical'`
2. Stories MUST be created in `stories/StatusPill.stories.tsx`.
3. Stories MUST include at least three variants.
