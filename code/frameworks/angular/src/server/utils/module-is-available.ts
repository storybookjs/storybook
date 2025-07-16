import { existsSync } from 'node:fs';

export const moduleIsAvailable = (moduleName: string): boolean => {
  try {
    const resolved = import.meta.resolve(moduleName);
    return existsSync(resolved);
  } catch (e) {
    return false;
  }
};
