import { createRequire } from 'node:module';

import { SupportedRenderer } from 'storybook/internal/types';

import { join } from 'pathe';

import { getRendererName } from '../helpers/mainConfigFile.ts';
import type { Fix } from '../types.ts';

// Docgen server turns on when `@storybook/react` resolves `typescript`, which npm and pnpm also
// install as a peer of react-docgen-typescript.
const reactResolvesTypescript = (projectDir: string) => {
  try {
    const react = createRequire(join(projectDir, 'package.json')).resolve(
      '@storybook/react/package.json'
    );
    createRequire(react).resolve('typescript');
    return true;
  } catch {
    return false;
  }
};

// Remove in Storybook 12, together with builder docgen.
export const reactDocgenOptional: Fix<{}> = {
  id: 'react-docgen-optional',
  link: 'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#react-react-docgen-is-an-optional-peer-dependency',
  prompt: () =>
    'Install react-docgen as a devDependency so Storybook keeps documenting the props of your React components',

  async check({ mainConfig, packageManager }) {
    const { reactDocgen } = (mainConfig.typescript ?? {}) as { reactDocgen?: unknown };
    if (
      getRendererName(mainConfig) !== SupportedRenderer.REACT ||
      packageManager.isDependencyInstalled('react-docgen') ||
      reactDocgen === false
    ) {
      return null;
    }
    const usesDocgenServer =
      mainConfig.features?.docgenServer !== false &&
      reactResolvesTypescript(packageManager.instanceDir);
    return usesDocgenServer ? null : {};
  },

  async run({ packageManager }) {
    await packageManager.addDependencies({ type: 'devDependencies', skipInstall: true }, [
      'react-docgen@^8.0.2',
    ]);
  },
};
