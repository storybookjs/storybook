import { dedent } from 'ts-dedent';

import { createBlocker } from './types.ts';

export const blocker = createBlocker({
  id: 'createReactApp',
  async check({ packageManager }) {
    const presetCreateReactAppVersion = await packageManager.getInstalledVersion(
      '@storybook/preset-create-react-app'
    );

    return presetCreateReactAppVersion !== null;
  },
  log() {
    return {
      title: 'Create React App: support removed',
      message: dedent`
        Storybook 11+ does not support Create React App projects.

        Migrate your project to Vite (e.g. with @storybook/react-vite) to keep using Storybook:
      `,
      link: 'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#create-react-app-support-removed',
    };
  },
});
