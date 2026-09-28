import { transformImports } from 'storybook/internal/common';

import type { Fix } from '../types.ts';

export const VITE_DEFAULT_VERSION = '^7.0.0';

export const nextjsToNextjsVite: Fix = {
  id: 'nextjs-to-nextjs-vite',
  link: 'https://storybook.js.org/docs/get-started/frameworks/nextjs-vite',
  defaultSelected: false,

  async check({ packageManager }) {
    return packageManager.getAllDependencies()['@storybook/nextjs'] ? {} : null;
  },

  prompt() {
    return 'Migrate from @storybook/nextjs to @storybook/nextjs-vite (Vite framework)';
  },

  transform: () => [
    {
      filter: { kind: ['main'] },
      handler: (code) => code.replace(/@storybook\/nextjs(?!-vite)/g, '@storybook/nextjs-vite'),
    },
    {
      filter: { kind: ['preview', 'manager', 'config', 'story'] },
      handler: (code) => transformImports(code, { '@storybook/nextjs': '@storybook/nextjs-vite' }),
    },
  ],

  async run({ packageManager, storybookVersion }) {
    const viteVersion = packageManager.getDependencyVersion('vite');
    await packageManager.removeDependencies(['@storybook/nextjs']);
    await packageManager.addDependencies({ type: 'devDependencies', skipInstall: true }, [
      `@storybook/nextjs-vite@${storybookVersion}`,
      ...(viteVersion ? [] : [`vite@${VITE_DEFAULT_VERSION}`]),
    ]);
  },
};
