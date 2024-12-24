import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { Dependency } from './types';

export const getActualPackageVersions = async (packages: Record<string, Partial<Dependency>>) => {
  const packageNames = Object.keys(packages);
  return Promise.all(packageNames.map(getActualPackageVersion));
};

export const getActualPackageVersion = async (packageName: string) => {
  try {
    const packageJson = await getActualPackageJson(packageName);
    return {
      name: packageName,
      version: packageJson.version,
    };
  } catch (err) {
    return { name: packageName, version: null };
  }
};

export const getActualPackageJson = async (packageName: string) => {
  const resolvedPackageJson = require.resolve(join(packageName, 'package.json'), {
    paths: [process.cwd()],
  });
  const packageJson = JSON.parse(await readFile(resolvedPackageJson, { encoding: 'utf8' }));
  return packageJson;
};
