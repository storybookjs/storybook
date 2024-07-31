import { existsSync, readJsonSync } from 'fs-extra';
import path from 'node:path';
import type { PackageJson } from '@storybook/core/types';
import { getProjectRoot } from '@storybook/core/common';

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
  if (!projectRootPath) return undefined;

  const keys = Object.keys(monorepoConfigs) as (keyof typeof monorepoConfigs)[];
  const monorepoType: MonorepoType = keys.find((monorepo) => {
    const configFile = path.join(projectRootPath, monorepoConfigs[monorepo]);
    return existsSync(configFile);
  }) as MonorepoType;

  if (monorepoType) {
    return monorepoType;
  }

  if (!existsSync(path.join(projectRootPath, 'package.json'))) {
    return undefined;
  }

  const packageJson = readJsonSync(path.join(projectRootPath, 'package.json')) as PackageJson;

  if (packageJson?.workspaces) {
    return 'Workspaces';
  }

  return undefined;
};
