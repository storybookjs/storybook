import picocolors from 'picocolors';
import { lt } from 'semver';
import { dedent } from 'ts-dedent';

import { createBlocker } from './types';

const minimalVersionsMap = {
  '@angular/core': '18.0.0',
  'react-scripts': '5.0.0',
  '@storybook/preact-webpack5': '9.0.0',
  '@storybook/preset-preact-webpack': '9.0.0',
  '@storybook/vue3-webpack5': '9.0.0',
  '@storybook/preset-vue3-webpack': '9.0.0',
  '@storybook/html-webpack5': '9.0.0',
  '@storybook/preset-html-webpack': '9.0.0',
  '@storybook/web-components-webpack5': '9.0.0',
  next: '14.1.0',
  preact: '10.0.0',
  svelte: '5.0.0',
  vue: '3.0.0',
  vite: '5.0.0',
};

type Result = {
  installedVersion: string | undefined;
  packageName: keyof typeof minimalVersionsMap;
  minimumVersion: string;
};
const typedKeys = <TKey extends string>(obj: Record<TKey, any>) => Object.keys(obj) as TKey[];

export const blocker = createBlocker({
  id: 'dependenciesVersions',
  async check({ packageManager }) {
    const list = await Promise.all(
      typedKeys(minimalVersionsMap).map(async (packageName) => ({
        packageName,
        installedVersion: await packageManager.getPackageVersion(packageName),
        minimumVersion: minimalVersionsMap[packageName],
      }))
    );

    return list.reduce<false | Result>((acc, { installedVersion, minimumVersion, packageName }) => {
      if (acc) {
        return acc;
      }
      if (packageName && installedVersion && lt(installedVersion, minimumVersion)) {
        return {
          installedVersion,
          packageName,
          minimumVersion,
        };
      }
      return acc;
    }, false);
  },
  log(options, data) {
    switch (data.packageName) {
      case 'react-scripts':
        return dedent`
          Support for react-script < 5.0.0 has been removed.
          Please see the migration guide for more information:
          ${picocolors.yellow(
            'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#create-react-app-dropped-cra4-support'
          )}
          
          Upgrade to the latest version of react-scripts.
        `;
      case '@storybook/preact-webpack5':
      case '@storybook/preset-preact-webpack':
        return dedent`
          Support for Preact Webpack5 has been removed.
          Please see the migration guide for more information:
          ${picocolors.yellow('https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#dropped-webpack5-builder-support-in-favor-of-vite')}
        `;
      case '@storybook/vue3-webpack5':
      case '@storybook/preset-vue3-webpack':
        return dedent`
          Support for Vue3 Webpack5 has been removed.
          Please see the migration guide for more information:
          ${picocolors.yellow('https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#dropped-webpack5-builder-support-in-favor-of-vite')}
        `;
      case '@storybook/html-webpack5':
      case '@storybook/preset-html-webpack':
        return dedent`
          Support for HTML Webpack5 has been removed.
          Please see the migration guide for more information:
          ${picocolors.yellow('https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#dropped-webpack5-builder-support-in-favor-of-vite')}
        `;
      case '@storybook/web-components-webpack5':
        return dedent`
          Support for Web Components Webpack5 has been removed.
          Please see the migration guide for more information:
          ${picocolors.yellow('https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#dropped-webpack5-builder-support-in-favor-of-vite')}
        `;
      case 'vue':
        return dedent`
          Support for Vue 2 has been removed.
          Please see the migration guide for more information:
          ${picocolors.yellow('https://v3-migration.vuejs.org/')}

          Please upgrade to the latest version of Vue.
        `;
      case '@angular/core':
        return dedent`
          Support for Angular < 18 has been removed.
          Please see the migration guide for more information:
          ${picocolors.yellow('https://angular.io/guide/update-to-version-15')}

          Please upgrade to the latest version of Angular.
        `;
      case 'next':
        return dedent`
          Support for Next.js < 14.1 has been removed.
          Please see the migration guide for more information:
          ${picocolors.yellow(
            'https://nextjs.org/docs/pages/building-your-application/upgrading/version-13'
          )}

          Please upgrade to the latest version of Next.js.
        `;
      default:
        return dedent`
          Support for ${data.packageName} version < ${data.minimumVersion} has been removed.
          Since version 8, Storybook needs a minimum version of ${data.minimumVersion}, but you have version ${data.installedVersion}.

          Please update this dependency.
        `;
    }
  },
});
