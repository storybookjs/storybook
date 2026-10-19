import { createRequire } from 'node:module';

import { SupportedRenderer } from 'storybook/internal/types';

import { join } from 'pathe';

import { getFrameworkPackageName, getRendererName } from '../helpers/mainConfigFile.ts';
import type { Fix } from '../types.ts';

const resolveFrom = (from: string, id: string) => {
  try {
    return createRequire(from).resolve(id);
  } catch {
    return undefined;
  }
};

// Mirrors `isDocgenProviderEnabled` in `@storybook/react`'s preset, which turns docgen server on by
// default, from the project directory instead of the renderer's own process. pnpm links
// `@storybook/react` only into the framework's `node_modules`, so it is resolved through the framework.
const reactResolvesTypescript = (projectDir: string, framework: string | null) => {
  const project = join(projectDir, 'package.json');
  const from = (framework && resolveFrom(project, `${framework}/package.json`)) || project;
  const react = resolveFrom(from, '@storybook/react/package.json');
  return !!react && !!resolveFrom(react, 'typescript');
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
      reactResolvesTypescript(packageManager.instanceDir, getFrameworkPackageName(mainConfig));
    return usesDocgenServer ? null : {};
  },

  async run({ packageManager }) {
    await packageManager.addDependencies({ type: 'devDependencies', skipInstall: true }, [
      'react-docgen@^8.0.2',
    ]);
  },
};
