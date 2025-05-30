import picocolors from 'picocolors';
import semver from 'semver';
import { dedent } from 'ts-dedent';

import { createBlocker } from './types';

export const blocker = createBlocker({
  id: 'experimentalAddonTestVitest',
  link: 'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#vitest-addon-former-storybookexperimental-addon-test-vitest-20-support-is-dropped',
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
    return dedent`
      ${picocolors.magenta('@storybook/experimental-addon-test')} is being stabilized in Storybook 9.
      
      The addon will be renamed to ${picocolors.magenta('@storybook/addon-vitest')} and as part of this stabilization, we have dropped support for Vitest 2.
      
      You have two options to proceed:
      1. Remove ${picocolors.magenta('@storybook/experimental-addon-test')} if you don't need it
      2. Upgrade to ${picocolors.bold('Vitest 3')} to continue using the addon
      
      After addressing this, you can try running the upgrade command again.
    `;
  },
});
