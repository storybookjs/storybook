import { lt } from 'semver';
import { dedent } from 'ts-dedent';

import { createBlocker } from './types.ts';

interface AddonVitestVitest4Data {
  vitestVersion: string;
}

export const blocker = createBlocker<AddonVitestVitest4Data>({
  id: 'addonVitestVitest4',
  async check({ packageManager }) {
    try {
      const addonVersion = await packageManager.getInstalledVersion('@storybook/addon-vitest');
      if (!addonVersion) {
        return false;
      }

      const vitestVersion = await packageManager.getInstalledVersion('vitest');
      if (!vitestVersion) {
        return false;
      }

      // Without a vite-plus /versions export, getInstalledVersion falls back to the
      // vite-plus wrapper version (e.g. 0.1.16) instead of the vendored Vitest version.
      // Skip those, and 0.0.0 canaries, rather than falsely blocking.
      if (vitestVersion.startsWith('0.')) {
        return false;
      }

      return lt(vitestVersion, '4.0.0') ? { vitestVersion } : false;
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
