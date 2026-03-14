import semver from 'semver';
import { dedent } from 'ts-dedent';

import { createBlocker } from './types';

export const blocker = createBlocker({
  id: 'experimentalAddonTestVitest',
  async check({ packageManager }) {
    const experimentalAddonTestVersion = await packageManager.getInstalledVersion(
      '@storybook/experimental-addon-test'
    );

    if (!experimentalAddonTestVersion) {
      return false;
    }

    const vitestVersion = await packageManager.getInstalledVersion('vitest');

    if (!vitestVersion) {
      return false;
    }

    return semver.lt(vitestVersion, '3.0.0');
  },
  log() {
    return {
      title: 'Experimental Addon Test Vitest',
      message: dedent`
      @storybook/experimental-addon-test is being stabilized in Storybook 9.
      
      The addon will be renamed to @storybook/addon-vitest and as part of this stabilization, we have dropped support for Vitest 2.
      
      You have two options to proceed:
      1. Remove @storybook/experimental-addon-test if you don't need it
      2. Upgrade to Vitest 3 to continue using the addon
    `,
      link: 'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#experimental-addon-test-vitest',
    };
  },
});
