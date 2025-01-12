import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export function readPackageJson(): Record<string, any> | false {
  const packageJsonPath = resolve('package.json');
  if (!existsSync(packageJsonPath)) {
    return false;
  }

  const jsonContent = readFileSync(packageJsonPath, 'utf8');
  return JSON.parse(jsonContent);
}
