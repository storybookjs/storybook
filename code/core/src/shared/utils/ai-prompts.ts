/**
 * Source of truth for AI prompts throughout the application.
 */

const DEFAULT_STORYBOOK_EXECUTOR = 'npx storybook';

export function getAiSetupPrompt(executor = DEFAULT_STORYBOOK_EXECUTOR) {
  return `Run \`${executor} skills setup\` and follow its instructions precisely.`;
}

// Offered by the review hint in the sidebar. It names the skill in plain words so it works with the
// project skill (`ui-review`) and the plugin skill (`storybook:ui-review`) alike, and "the stories
// that changed" leads the agent to the skill's `stories changed` step.
export const UI_REVIEW_PROMPT =
  'Use the ui-review skill to publish a Storybook review of the stories that changed.';
