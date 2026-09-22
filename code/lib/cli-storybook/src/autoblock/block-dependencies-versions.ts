import { dedent } from 'ts-dedent';

import { createBlocker } from './types.ts';
import { findOutdatedPackage } from './utils.ts';

const minimalVersionsMap = {
  '@angular/core': '21.0.0',
  next: '15.0.0',
  preact: '10.0.0',
  react: '18.0.0',
  'react-dom': '18.0.0',
  svelte: '5.0.0',
  vue: '3.0.0',
  vite: '5.0.0',
} as const;

const conditionalVersionsMap = {
  vitest: { gatedBy: '@storybook/addon-vitest', minimumVersion: '4.0.0' },
} as const;

export const blocker = createBlocker({
  id: 'dependenciesVersions',
  async check({ packageManager }) {
    const outdated = await findOutdatedPackage<typeof minimalVersionsMap>(minimalVersionsMap, {
      packageManager,
    });

    // React experimental/canary builds (0.0.0*) ship react-dom/client and are treated as
    // React 18+ by the react-dom-shim, so their version string must not block the upgrade.
    if (
      outdated &&
      (outdated.packageName === 'react' || outdated.packageName === 'react-dom') &&
      outdated.installedVersion?.startsWith('0.0.0')
    ) {
      return false;
    }

    if (outdated !== false) {
      return outdated;
    }

    // Conditional floors apply only when their gating package is installed.
    try {
      const installedGates = await Promise.all(
        Object.entries(conditionalVersionsMap).map(
          async ([packageName, { gatedBy, minimumVersion }]) => {
            const gateVersion = await packageManager.getInstalledVersion(gatedBy);
            return gateVersion ? ([packageName, minimumVersion] as const) : null;
          }
        )
      );

      const gatedVersions = Object.fromEntries(installedGates.filter((gate) => gate !== null));

      if (Object.keys(gatedVersions).length === 0) {
        return false;
      }

      return await findOutdatedPackage(gatedVersions, { packageManager });
    } catch {
      // If we can't determine the versions, don't block (blockers run in parallel).
      return false;
    }
  },
  log(data) {
    switch (data.packageName) {
      case '@angular/core':
        return {
          title: 'Require Angular v21 and up',
          message: dedent`
            Support for Angular < 21 has been removed.
            Please see the migration guide for more information:
          `,
          link: 'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#angular-requires-angular-21-or-higher',
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
      case 'react':
      case 'react-dom':
        return {
          title: 'React 18 or newer required',
          message: dedent`
            Support for React < 18 has been removed.
            Please see the migration guide for more information:
          `,
          link: 'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#react-require-v18-and-up',
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
