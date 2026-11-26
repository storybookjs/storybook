import { transformImports } from 'storybook/internal/common';
import { logger, prompt } from 'storybook/internal/node-logger';
import { dedent } from 'ts-dedent';

import { assertMainConfigNamesFramework } from '../helpers/main-config-framework.ts';
import type { Fix } from '../types.ts';

export const VITE_DEFAULT_VERSION = '^7.0.0';

/** Logged when the user declines this migration, mirroring the dev-server deprecation in the `@storybook/nextjs` preset. */
export const nextjsDeprecationWarning = dedent`
  @storybook/nextjs is deprecated and will be removed in Storybook 12.
  Migrate to @storybook/nextjs-vite by running \`npx storybook automigrate nextjs-to-nextjs-vite\`.
`;

const NEXTJS_FRAMEWORK = /@storybook\/nextjs(?!-vite)/g;

const VITE_CONFIG_DOC_URL = 'https://storybook.js.org/docs/builders/vite#configure';

export interface NextjsToNextjsViteOptions {
  /** The main config has a `webpackFinal` hook, which does not carry over to Vite. */
  hasWebpackFinal: boolean;
}

export const nextjsToNextjsVite: Fix<NextjsToNextjsViteOptions> = {
  id: 'nextjs-to-nextjs-vite',
  link: 'https://storybook.js.org/docs/get-started/frameworks/nextjs-vite',
  defaultSelected: true,
  skipWarning: nextjsDeprecationWarning,

  async check({ packageManager, files, mainConfigPath }) {
    if (!packageManager.getAllDependencies()['@storybook/nextjs']) {
      return null;
    }

    return {
      hasWebpackFinal:
        !!mainConfigPath && (await files.read(mainConfigPath)).includes('webpackFinal'),
    };
  },

  prompt() {
    return 'Migrate from @storybook/nextjs to @storybook/nextjs-vite (Vite framework)';
  },

  transform: () => [
    {
      filter: { kind: ['main'] },
      handler: (code) => code.replace(NEXTJS_FRAMEWORK, '@storybook/nextjs-vite'),
    },
    {
      filter: { kind: ['preview', 'manager', 'config', 'story'] },
      handler: (code) => transformImports(code, { '@storybook/nextjs': '@storybook/nextjs-vite' }),
    },
  ],

  async run({ result, files, mainConfigPath, packageManager, storybookVersion, yes }) {
    if (result.hasWebpackFinal) {
      logger.logBox(
        dedent`
          We detected a \`webpackFinal\` hook in your Storybook main config.

          \`webpackFinal\` is a Webpack-specific API and will not carry over to Vite.
          You will need to port it to \`viteFinal\` after the migration.
          See ${VITE_CONFIG_DOC_URL} for porting guidance.
        `
      );

      const shouldContinue =
        !yes &&
        (await prompt.confirm({
          message: 'I detected a webpackFinal hook. It will not carry over. Continue anyway?',
          initialValue: false,
        }));

      if (!shouldContinue) {
        logger.log(
          'Migration cancelled. Port your webpackFinal hook to viteFinal first, then run `npx storybook automigrate nextjs-to-nextjs-vite` again.'
        );
        return false;
      }
    }

    await assertMainConfigNamesFramework(files, mainConfigPath, '@storybook/nextjs', {
      from: '@storybook/nextjs',
      to: '@storybook/nextjs-vite',
    });
    const viteVersion = packageManager.getDependencyVersion('vite');
    await packageManager.removeDependencies(['@storybook/nextjs']);
    await packageManager.addDependencies({ type: 'devDependencies', skipInstall: true }, [
      `@storybook/nextjs-vite@${storybookVersion}`,
      ...(viteVersion ? [] : [`vite@${VITE_DEFAULT_VERSION}`]),
    ]);
  },
};
