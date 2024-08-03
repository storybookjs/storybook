import { readJson } from 'fs-extra';
import path from 'node:path';

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
  const resolvedPackageJson = require.resolve(path.join(packageName, 'package.json'), {
    paths: [process.cwd()],
  });
  const packageJson = await readJson(resolvedPackageJson);
  return packageJson;
};
