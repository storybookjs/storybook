import { coerce, satisfies } from 'semver';

import { type Check, CompatibilityType } from './index';

/**
 * Detect existing Vitest/MSW version, if mismatch prompt for ignoring test intent
 *
 * - Yes -> ignore test intent
 * - No -> exit
 */
const name = 'Vitest and MSW compatibility';
export const packageVersions: Check = {
  condition: async (context) => {
    if (context.packageManager) {
      const reasons = [];
      const packageManager = context.packageManager;

      const vitestVersionSpecifier = await packageManager.getInstalledVersion('vitest');
      const coercedVitestVersion = vitestVersionSpecifier ? coerce(vitestVersionSpecifier) : null;
      if (coercedVitestVersion && !satisfies(coercedVitestVersion, '>=2.1.0')) {
        reasons.push(`Vitest >=2.1.0 is required, found ${coercedVitestVersion}`);
      }

      const mswVersionSpecifier = await packageManager.getInstalledVersion('msw');
      const coercedMswVersion = mswVersionSpecifier ? coerce(mswVersionSpecifier) : null;
      if (coercedMswVersion && !satisfies(coercedMswVersion, '>=2.0.0')) {
        reasons.push(`Mock Service Worker (msw) >=2.0.0 is required, found ${coercedMswVersion}`);
      }

      return reasons.length
        ? { type: CompatibilityType.INCOMPATIBLE, reasons }
        : { type: CompatibilityType.COMPATIBLE };
    }
    return {
      type: CompatibilityType.INCOMPATIBLE,
      reasons: ['Missing packageManager or JsPackageManagerFactory on context'],
    };
  },
};
