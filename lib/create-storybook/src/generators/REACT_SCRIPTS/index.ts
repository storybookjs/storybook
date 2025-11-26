import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ProjectType } from 'storybook/internal/cli';
import { SupportedBuilder, SupportedRenderer } from 'storybook/internal/types';

import semver from 'semver';
import { dedent } from 'ts-dedent';

import { defineGeneratorModule } from '../modules/GeneratorModule';

export default defineGeneratorModule({
  metadata: {
    projectType: ProjectType.REACT_SCRIPTS,
    renderer: SupportedRenderer.REACT,
    builderOverride: SupportedBuilder.WEBPACK5,
  },
  configure: async (packageManager, context) => {
    const monorepoRootPath = fileURLToPath(new URL('../../../../../../..', import.meta.url));
    const extraMain = context.linkable
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

    const craVersion =
      (await packageManager.getModulePackageJSON('react-scripts'))?.version ?? null;

    if (craVersion === null) {
      throw new Error(dedent`
        It looks like you're trying to initialize Storybook in a CRA project that does not have react-scripts installed.
        Please install it and make sure it's of version 5 or higher, which are the versions supported by Storybook 7.0+.
      `);
    }

    if (craVersion && semver.lt(craVersion, '5.0.0')) {
      throw new Error(dedent`
        Storybook 7.0+ doesn't support react-scripts@<5.0.0.
  
        https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#create-react-app-dropped-cra4-support
      `);
    }

    // TODO: Evaluate if adding prop-types is correct after removing pnp compatibility code in SB11
    // Miscellaneous dependency to add to be sure Storybook + CRA is working fine with Yarn PnP mode
    const extraPackages = ['webpack', 'prop-types'];
    const extraAddons = ['@storybook/preset-create-react-app'];

    return {
      webpackCompiler: () => undefined,
      extraAddons,
      extraPackages,
      staticDir: existsSync(resolve('./public')) ? 'public' : undefined,
      extraMain,
    };
  },
});
