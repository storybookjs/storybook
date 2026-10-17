import { typescript6PackageToInstall } from 'storybook/internal/common';

import type { Fix } from '../types.ts';

export const typescript6: Fix = {
  id: 'typescript6',
  link: 'https://storybook.js.org/docs/configure/integration/typescript',
  prompt: () =>
    'Install @typescript/typescript6 so Storybook can read component types on TypeScript 7',

  async check({ packageManager }) {
    return (await typescript6PackageToInstall(packageManager)) ? {} : null;
  },

  async run({ packageManager }) {
    const dependency = await typescript6PackageToInstall(packageManager);
    if (!dependency) {
      return;
    }
    await packageManager.addDependencies({ type: 'devDependencies', skipInstall: true }, [
      dependency,
    ]);
  },
};
