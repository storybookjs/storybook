import type { Check } from './Check';
import { configDir } from './configDir';
import { frameworkPackage } from './frameworkPackage';
import { frameworkTest } from './frameworkTest';
import { packageVersions } from './packageVersions';
import { vitestConfigFiles } from './vitestConfigFiles';

export const checks = {
  configDir,
  frameworkPackage,
  frameworkTest,
  packageVersions,
  vitestConfigFiles,
} satisfies Record<string, Check>;
