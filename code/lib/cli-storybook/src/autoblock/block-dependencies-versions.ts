import { dedent } from 'ts-dedent';

import { createBlocker } from './types.ts';
import { findOutdatedPackage } from './utils.ts';

const minimalVersionsMap = {
  '@angular/core': '18.0.0',
  'react-scripts': '5.0.0',
  next: '15.0.0',
  preact: '10.0.0',
  react: '18.0.0',
  'react-dom': '18.0.0',
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
    // React experimental/canary builds (0.0.0*) ship react-dom/client and are treated as
    // React 18+ by the react-dom-shim, so their version string must not block the upgrade.
    if (
      outdated &&
      (outdated.packageName === 'react' || outdated.packageName === 'react-dom') &&
      outdated.installedVersion?.startsWith('0.0.0')
    ) {
      return false;
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
      case 'react':
      case 'react-dom':
        return {
          title: 'React 18 support removed',
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
