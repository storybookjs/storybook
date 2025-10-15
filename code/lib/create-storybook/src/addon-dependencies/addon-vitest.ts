import { AddonVitestService } from 'storybook/internal/cli';
import type { JsPackageManager } from 'storybook/internal/common';

/**
 * Get additional dependencies required by @storybook/addon-vitest
 *
 * Wrapper function that delegates to AddonVitestService for centralized logic. Returns the packages
 * needed: vitest, @vitest/browser, playwright, coverage reporter, and nextjs-vite if applicable
 */
export async function getAddonVitestDependencies(
  packageManager: JsPackageManager,
  frameworkPackageName?: string
): Promise<string[]> {
  const service = new AddonVitestService();
  return service.collectDependencies(packageManager, frameworkPackageName);
}
