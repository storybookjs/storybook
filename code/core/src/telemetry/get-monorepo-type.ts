import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { getProjectRoot } from 'storybook/internal/common';
import type { PackageJson } from 'storybook/internal/types';

export const monorepoConfigs = {
  Nx: 'nx.json',
  Turborepo: 'turbo.json',
  Lerna: 'lerna.json',
  Rush: 'rush.json',
  Lage: 'lage.config.json',
} as const;

export type MonorepoType = keyof typeof monorepoConfigs | 'Workspaces' | undefined;

export const getMonorepoType = (): MonorepoType => {
  const keys = Object.keys(monorepoConfigs) as (keyof typeof monorepoConfigs)[];
  const monorepoType: MonorepoType = keys.find((monorepo) => {
    const configFile = join(getProjectRoot(), monorepoConfigs[monorepo]);
    return existsSync(configFile);
  }) as MonorepoType;

  if (monorepoType) {
    return monorepoType;
  }

  if (!existsSync(join(getProjectRoot(), 'package.json'))) {
    return undefined;
  }

  const packageJson = JSON.parse(
    readFileSync(join(getProjectRoot(), 'package.json'), { encoding: 'utf8' })
  ) as PackageJson;

  if (packageJson?.workspaces) {
    return 'Workspaces';
  }

  return undefined;
};
