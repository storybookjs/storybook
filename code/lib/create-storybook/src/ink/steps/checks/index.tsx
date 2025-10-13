import type { Check } from './Check';
import { packageVersions } from './packageVersions';
import { vitestConfigFiles } from './vitestConfigFiles';

export const checks = {
  packageVersions,
  vitestConfigFiles,
} satisfies Record<string, Check>;
