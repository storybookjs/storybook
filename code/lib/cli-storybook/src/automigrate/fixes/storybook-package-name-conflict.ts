import picocolors from 'picocolors';
import { dedent } from 'ts-dedent';

import type { Fix } from '../types.ts';

export const storybookPackageNameConflict: Fix = {
  id: 'storybookPackageNameConflict',
  promptType: 'notification',
  link: 'https://github.com/storybookjs/storybook/issues/28725',

  async check({ packageManager }) {
    return packageManager.primaryPackageJson.packageJson.name === 'storybook' ? {} : null;
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
