/**
 * Source of truth for AI prompts throughout the application.
 */

const DEFAULT_STORYBOOK_EXECUTOR = 'npx storybook';

export function getAiSetupPrompt(executor = DEFAULT_STORYBOOK_EXECUTOR) {
  return `Run \`${executor} ai setup\` and follow its instructions precisely.`;
}
