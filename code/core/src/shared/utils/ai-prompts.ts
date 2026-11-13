/**
 * Source of truth for AI prompts throughout the application.
 */

const DEFAULT_STORYBOOK_EXECUTOR = 'npx storybook';

export function getAiSetupPrompt(executor = DEFAULT_STORYBOOK_EXECUTOR) {
  return `Run \`${executor} skills setup\` and follow its instructions precisely.`;
}

// Offered by the review hint in the sidebar. The same line the agent ends its answer with after a UI
// change (the Storybook section of AGENTS.md), so users meet one wording in both places. `/ui-review`
// resolves to the project skill `ui-review` and to the plugin skill `storybook:ui-review`; sent as a
// message, it makes the agent publish a review of the changed stories.
export const UI_REVIEW_PROMPT =
  'Use the /ui-review skill to see the changed components in Storybook';
