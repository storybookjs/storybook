import { type Check } from './Check';
import { CompatibilityType } from './CompatibilityType';

/**
 * Check for presence of nextjs when using @storybook/nextjs, prompt if there's a mismatch
 *
 * - Yes -> continue
 * - No -> exit
 */
export const frameworkPackage: Check = {
  condition: async (context, state) => {
    if (state.framework !== 'nextjs') {
      return { type: CompatibilityType.COMPATIBLE };
    }
    if (context.packageManager) {
      const packageManager = context.packageManager;
      const nextJsVersionSpecifier = await packageManager.getInstalledVersion('next');

      return nextJsVersionSpecifier
        ? { type: CompatibilityType.COMPATIBLE }
        : { type: CompatibilityType.INCOMPATIBLE, reasons: ['Missing nextjs dependency'] };
    }
    return {
      type: CompatibilityType.INCOMPATIBLE,
      reasons: ['Missing JsPackageManagerFactory on context'],
    };
  },
};
