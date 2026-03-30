import picocolors from 'picocolors';
import { dedent } from 'ts-dedent';

import type { Fix } from '../types';

interface StorybookPackageNameOptions {
  packageName: string;
}

/**
 * Detects when a project's package.json "name" field is "storybook",
 * which conflicts with the actual storybook package in node_modules
 * when using npm/pnpm/yarn workspaces.
 *
 * See: https://github.com/storybookjs/storybook/issues/28725
 */
export const storybookPackageNameConflict: Fix<StorybookPackageNameOptions> = {
  id: 'storybookPackageNameConflict',
  promptType: 'notification',
  link: 'https://github.com/storybookjs/storybook/issues/28725',

  async check({ packageManager }) {
    const packageName = packageManager.primaryPackageJson.packageJson.name;

    if (packageName === 'storybook') {
      return { packageName };
    }

    return null;
  },

  prompt() {
    return dedent`
      Your package.json ${picocolors.cyan('"name"')} field is set to ${picocolors.cyan('"storybook"')}.

      In npm, pnpm, or yarn workspaces this creates a symlink at
      ${picocolors.yellow('node_modules/storybook')} that shadows the real Storybook
      package, causing ${picocolors.red('"Cannot find module storybook/internal/..."')} errors.

      To fix this, rename the ${picocolors.cyan('"name"')} field in your package.json
      to something other than ${picocolors.cyan('"storybook"')} (e.g. "my-storybook", "docs", "@myorg/storybook").
    `;
  },
};
