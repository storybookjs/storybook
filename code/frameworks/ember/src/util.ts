import { sync as findUpSync } from 'find-up';
import path from 'path';

export const findDistFile = (cwd: string, relativePath: string) => {
  const nearestPackageJson = findUpSync('package.json', { cwd });
  if (!nearestPackageJson) {
    throw new Error(`Could not find package.json in: ${cwd}`);
  }
  const packageDir = path.dirname(nearestPackageJson);

  return path.join(packageDir, 'dist', relativePath);
};
