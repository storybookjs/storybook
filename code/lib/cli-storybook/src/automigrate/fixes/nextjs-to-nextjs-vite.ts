import { transformImports } from 'storybook/internal/common';
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

export const nextjsToNextjsVite: Fix = {
  id: 'nextjs-to-nextjs-vite',
  link: 'https://storybook.js.org/docs/get-started/frameworks/nextjs-vite',
  defaultSelected: true,

  async check({ packageManager }) {
    return packageManager.getAllDependencies()['@storybook/nextjs'] ? {} : null;
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

  async run({ files, mainConfigPath, packageManager, storybookVersion }) {
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
