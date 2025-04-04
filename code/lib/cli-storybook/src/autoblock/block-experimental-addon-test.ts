import picocolors from 'picocolors';
import semver from 'semver';
import { dedent } from 'ts-dedent';

import { createBlocker } from './types';

export const blocker = createBlocker({
  id: 'experimentalAddonTestVitest',
  async check({ packageJson, packageManager }) {
    const dependencies = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    // Check if @storybook/experimental-addon-test is installed
    const hasExperimentalAddon = '@storybook/experimental-addon-test' in dependencies;

    if (!hasExperimentalAddon) {
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
      ${picocolors.bold('@storybook/experimental-addon-test')} is being stabilized in Storybook 9.
      
      The addon will be renamed to ${picocolors.bold('@storybook/addon-vitest')} and as part of this stabilization, we have dropped support for Vitest 2.
      
      You have two options to proceed:
      1. Remove ${picocolors.bold('@storybook/experimental-addon-test')} if you don't need it
      2. Upgrade to ${picocolors.bold('Vitest 3')} to continue using the addon
      
      After addressing this, you can try running the upgrade command again.
    `;
  },
});
