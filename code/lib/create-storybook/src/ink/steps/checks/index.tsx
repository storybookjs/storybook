import type { ContextType } from 'react';

import { type State } from '..';
import type { AppContext } from '../../utils/context';
import { configDir } from './configDir';
import { frameworkPackage } from './frameworkPackage';
import { frameworkTest } from './frameworkTest';
import { packageVersions } from './packageVersions';
import { vitestConfigFiles } from './vitestConfigFiles';

export const CompatibilityType = {
  LOADING: 'loading' as const,
  IGNORED: 'ignored' as const,
  COMPATIBLE: 'compatible' as const,
  INCOMPATIBLE: 'incompatible' as const,
};

export type CompatibilityResult =
  | { type: typeof CompatibilityType.LOADING }
  | { type: typeof CompatibilityType.IGNORED }
  | { type: typeof CompatibilityType.COMPATIBLE }
  | { type: typeof CompatibilityType.INCOMPATIBLE; reasons: string[] };

export interface Check {
  condition: (
    context: ContextType<typeof AppContext>,
    state: State
  ) => Promise<CompatibilityResult>;
}

export const checks = {
  configDir,
  frameworkPackage,
  frameworkTest,
  packageVersions,
  vitestConfigFiles,
} satisfies Record<string, Check>;
