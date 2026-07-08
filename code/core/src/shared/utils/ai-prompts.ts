/**
 * Source of truth for AI prompts throughout the application.
 */

import type { JsPackageManager } from '../../common/js-package-manager/JsPackageManager.ts';

const DEFAULT_STORYBOOK_EXECUTOR = 'npx storybook';

export function getStorybookAiSetupCommand(packageManager: JsPackageManager) {
  return packageManager.getPackageCommand(['storybook', 'ai', 'setup']);
}

export function getAiSetupPrompt(executor = DEFAULT_STORYBOOK_EXECUTOR) {
  return `Run \`${executor} ai setup\` and follow its instructions precisely.`;
}
