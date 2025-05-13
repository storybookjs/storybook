import { dirname, join } from 'node:path';

import { sync as findUpSync } from 'find-up';

export const findDistFile = (cwd: string, relativePath: string) => {
  const nearestPackageJson = findUpSync('package.json', { cwd });
  if (!nearestPackageJson) {
    throw new Error(`Could not find package.json in: ${cwd}`);
  }
  const packageDir = dirname(nearestPackageJson);

  return join(packageDir, 'dist', relativePath);
};
