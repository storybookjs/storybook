import { dirname, join } from 'node:path';

import { getProjectRoot } from '@storybook/core/internal/common';

import * as pkg from 'empathic/package';

export const findDistFile = (cwd: string, relativePath: string) => {
  const nearestPackageJson = pkg.up({ cwd, last: getProjectRoot() });
  if (!nearestPackageJson) {
    throw new Error(`Could not find package.json in: ${cwd}`);
  }
  const packageDir = dirname(nearestPackageJson);

  return join(packageDir, 'dist', relativePath);
};
