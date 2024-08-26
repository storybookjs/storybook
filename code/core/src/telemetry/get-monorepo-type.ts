import { join } from 'node:path';

import { getProjectRoot } from '@storybook/core/common';
import type { PackageJson } from '@storybook/core/types';

import { existsSync, readJsonSync } from 'fs-extra';

export const monorepoConfigs = {
  Nx: 'nx.json',
  Turborepo: 'turbo.json',
  Lerna: 'lerna.json',
  Rush: 'rush.json',
  Lage: 'lage.config.json',
} as const;

export type MonorepoType = keyof typeof monorepoConfigs | 'Workspaces' | undefined;

export const getMonorepoType = (): MonorepoType => {
  const projectRootPath = getProjectRoot();

  if (!projectRootPath) {
    return undefined;
  }

  const keys = Object.keys(monorepoConfigs) as (keyof typeof monorepoConfigs)[];
  const monorepoType: MonorepoType = keys.find((monorepo) => {
    const configFile = join(projectRootPath, monorepoConfigs[monorepo]);
    return existsSync(configFile);
  }) as MonorepoType;

  if (monorepoType) {
    return monorepoType;
  }

  if (!existsSync(join(projectRootPath, 'package.json'))) {
    return undefined;
  }

  const packageJson = readJsonSync(join(projectRootPath, 'package.json')) as PackageJson;

  if (packageJson?.workspaces) {
    return 'Workspaces';
  }

  return undefined;
};
