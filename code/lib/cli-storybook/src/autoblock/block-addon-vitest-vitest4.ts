import { dedent } from 'ts-dedent';

import { createBlocker } from './types.ts';
import { findOutdatedPackage } from './utils.ts';

interface AddonVitestVitest4Data {
  vitestVersion: string;
}

export const blocker = createBlocker<AddonVitestVitest4Data>({
  id: 'addonVitestVitest4',
  async check({ packageManager }) {
    try {
      const [outdated, addonVersion] = await Promise.all([
        findOutdatedPackage({ vitest: '4.0.0' }, { packageManager }),
        packageManager.getInstalledVersion('@storybook/addon-vitest'),
      ]);

      if (outdated === false || !addonVersion || !outdated.installedVersion) {
        return false;
      }

      return { vitestVersion: outdated.installedVersion };
    } catch {
      // If we can't determine the version, don't block (blockers run in parallel).
      return false;
    }
  },
  log({ vitestVersion }) {
    return {
      title: 'Vitest 4 required by @storybook/addon-vitest',
      message: dedent`
        The addon requires Vitest 4.0.0 or higher. You are currently using Vitest ${vitestVersion}.

        Please upgrade Vitest to 4.0.0 or higher before upgrading Storybook:
        1. Update vitest (and any @vitest/* packages) in your project to version 4
        2. Run your test suite to verify the migration
      `,
      link: 'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#vitest-addon-requires-vitest-40-or-higher',
    };
  },
});
