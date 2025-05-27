import picocolors from 'picocolors';
import { dedent } from 'ts-dedent';

import { createBlocker } from './types';

export const blocker = createBlocker({
  id: 'svelteWebpack5Removal',
  link: 'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#svelte-dropped-support-for-storybooksvelte-webpack5',
  async check({ packageJson }) {
    const dependencies = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    // Check if @storybook/svelte-webpack5 is a dependency
    return '@storybook/svelte-webpack5' in dependencies;
  },
  log() {
    return dedent`
      ${picocolors.bold('@storybook/svelte-webpack5')} is no longer supported.
      
      You need to migrate to ${picocolors.bold('@storybook/svelte-vite')} instead.
    `;
  },
});
