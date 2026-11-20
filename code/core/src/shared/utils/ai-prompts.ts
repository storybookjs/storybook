/**
 * Source of truth for AI prompts throughout the application.
 */

const DEFAULT_STORYBOOK_EXECUTOR = 'npx storybook';

export function getAiSetupPrompt(executor = DEFAULT_STORYBOOK_EXECUTOR) {
  return `Run \`${executor} skills setup\` and follow its instructions precisely.`;
}

// Offered by the review hint in the sidebar. #37421 makes the agent end its answer with the same line
// after a UI change (the Storybook section of AGENTS.md), so users meet one wording. Agents map
// `/ui-review` to the project skill `ui-review` or the plugin skill `storybook:ui-review`.
export const UI_REVIEW_PROMPT =
  'Use the /ui-review skill to see the changed components in Storybook';
