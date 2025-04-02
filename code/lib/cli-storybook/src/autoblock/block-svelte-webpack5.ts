import picocolors from 'picocolors';
import { dedent } from 'ts-dedent';

import { createBlocker } from './types';

export const blocker = createBlocker({
  id: 'svelteWebpack5Removal',
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
      ${picocolors.bold('@storybook/svelte-webpack5')} is no longer supported in Storybook 9.
      
      You need to migrate to ${picocolors.bold('@storybook/svelte-vite')} instead.
      
      Please follow the setup guide for @storybook/svelte-vite:
      ${picocolors.yellow('https://storybook.js.org/docs/get-started/frameworks/svelte-vite')}
      
      After migrating, you can remove @storybook/svelte-webpack5 from your project and try running the upgrade command again.
    `;
  },
});
