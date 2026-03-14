import { dedent } from 'ts-dedent';

import { createBlocker } from './types';
import { findOutdatedPackage } from './utils';

const minimalVersionsMap = {
  '@angular/core': '18.0.0',
  'react-scripts': '5.0.0',
  next: '14.1.0',
  preact: '10.0.0',
  svelte: '5.0.0',
  vue: '3.0.0',
  vite: '5.0.0',
} as const;

export const blocker = createBlocker({
  id: 'dependenciesVersions',
  async check({ packageManager }) {
    return findOutdatedPackage<typeof minimalVersionsMap>(minimalVersionsMap, { packageManager });
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
          title: 'Next.js 14.1 support removed',
          message: dedent`
            Support for Next.js < 14.1 has been removed.
            Please see the migration guide for more information:
          `,
          link: 'https://nextjs.org/docs/pages/building-your-application/upgrading/version-13',
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
