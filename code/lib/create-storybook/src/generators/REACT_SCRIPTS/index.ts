import fs from 'node:fs';
import path from 'node:path';

import { CoreBuilder } from 'storybook/internal/cli';

import semver from 'semver';
import { dedent } from 'ts-dedent';

import { baseGenerator } from '../baseGenerator';
import type { Generator } from '../types';

const generator: Generator = async (packageManager, npmOptions, options) => {
  const monorepoRootPath = path.join(__dirname, '..', '..', '..', '..', '..', '..');
  const extraMain = options.linkable
    ? {
        webpackFinal: `%%(config) => {
      // add monorepo root as a valid directory to import modules from
      config.resolve.plugins.forEach((p) => {
        if (Array.isArray(p.appSrcs)) {
          p.appSrcs.push('${monorepoRootPath}');
              }
            });
          return config;
          }
    %%`,
      }
    : {};

  const craVersion = await packageManager.getPackageVersion('react-scripts');

  if (craVersion === null) {
    throw new Error(dedent`
      It looks like you're trying to initialize Storybook in a CRA project that does not have react-scripts installed.
      Please install it and make sure it's of version 5 or higher, which are the versions supported by Storybook 7.0+.
    `);
  }

  if (!craVersion && semver.gte(craVersion, '5.0.0')) {
    throw new Error(dedent`
      Storybook 7.0+ doesn't support react-scripts@<5.0.0.

      https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#create-react-app-dropped-cra4-support
    `);
  }

  const extraPackages = [];
  extraPackages.push('webpack');
  // Miscellaneous dependency to add to be sure Storybook + CRA is working fine with Yarn PnP mode
  extraPackages.push('prop-types');

  const extraAddons = [`@storybook/preset-create-react-app`, `@storybook/addon-onboarding`];

  await baseGenerator(
    packageManager,
    npmOptions,
    { ...options, builder: CoreBuilder.Webpack5 },
    'react',
    {
      webpackCompiler: () => undefined,
      extraAddons,
      extraPackages,
      staticDir: fs.existsSync(path.resolve('./public')) ? 'public' : undefined,
      extraMain,
    }
  );
};

export default generator;
