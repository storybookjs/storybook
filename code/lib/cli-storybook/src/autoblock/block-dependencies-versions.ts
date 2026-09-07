import { dedent } from 'ts-dedent';

import { createBlocker } from './types.ts';
import { findOutdatedPackage } from './utils.ts';

const minimalVersionsMap = {
  '@angular/core': '18.0.0',
  'react-scripts': '5.0.0',
  next: '15.0.0',
  preact: '10.0.0',
  svelte: '5.0.0',
  vue: '3.0.0',
  vite: '5.0.0',
} as const;

export const blocker = createBlocker({
  id: 'dependenciesVersions',
  async check({ packageManager }) {
    const outdated = await findOutdatedPackage<typeof minimalVersionsMap>(minimalVersionsMap, {
      packageManager,
    });

    if (outdated === false) {
      // @storybook/addon-vitest requires Vitest 4, but Storybook core does not,
      // so the floor is gated on the addon being installed instead of being an
      // entry in minimalVersionsMap, which would block every Vitest < 4 project.
      try {
        const addonVersion = await packageManager.getInstalledVersion('@storybook/addon-vitest');

        if (addonVersion) {
          return await findOutdatedPackage({ vitest: '4.0.0' }, { packageManager });
        }
      } catch {
        // If we can't determine the version, don't block (blockers run in parallel).
        return false;
      }
    }

    return outdated;
  },
  log(data) {
    switch (data.packageName) {
      case '@angular/core':
        return {
          title: 'Angular 18 support removed',
          message: dedent`
            Support for Angular < 18 has been removed.
            Please see the migration guide for more information:
          `,
          link: 'https://angular.dev/update-guide',
        };
      case 'next':
        return {
          title: 'Next.js 15 support removed',
          message: dedent`
            Support for Next.js < 15 has been removed.
            Please see the migration guide for more information:
          `,
          link: 'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#nextjs-require-v15-and-up',
        };
      case 'vitest':
        return {
          title: 'Vitest 4 required by @storybook/addon-vitest',
          message: dedent`
            The addon requires Vitest 4.0.0 or higher. You are currently using Vitest ${data.installedVersion}.

            Please upgrade Vitest to 4.0.0 or higher before upgrading Storybook:
            1. Update vitest (and any @vitest/* packages) in your project to version 4
            2. Run your test suite to verify the migration
          `,
          link: 'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#vitest-addon-requires-vitest-40-or-higher',
        };
      default:
        return {
          title: `${data.packageName} version < ${data.minimumVersion} support removed`,
          message: dedent`
            Support for ${data.packageName} version < ${data.minimumVersion} has been removed.
            Storybook needs a minimum version of ${data.minimumVersion}, but you have version ${data.installedVersion}.
          `,
        };
    }
  },
});
