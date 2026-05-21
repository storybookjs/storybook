/**
 * Source of truth for AI prompts throughout the application.
 */

export function getAiSetupPrompt(executor = 'npx storybook') {
  return `Run \`${executor} ai setup\` and follow its instructions precisely.`;
}
