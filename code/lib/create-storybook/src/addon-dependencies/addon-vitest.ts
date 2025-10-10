import type { JsPackageManager } from 'storybook/internal/common';

/**
 * Get additional dependencies required by @storybook/addon-vitest
 *
 * Extracted from addon-vitest postinstall logic without running installations. Returns the packages
 * needed: vitest, @vitest/browser, playwright, coverage reporter, and nextjs-vite if applicable
 */
export async function getAddonVitestDependencies(
  packageManager: JsPackageManager,
  frameworkPackageName?: string
): Promise<string[]> {
  const allDeps = packageManager.getAllDependencies();
  const dependencies: string[] = [];

  // Only install these dependencies if they are not already installed
  const basePackages = ['vitest', '@vitest/browser', 'playwright'];
  for (const pkg of basePackages) {
    if (!allDeps[pkg]) {
      dependencies.push(pkg);
    }
  }

  // Add nextjs-vite plugin if using Next.js
  if (frameworkPackageName === '@storybook/nextjs') {
    try {
      const storybookVersion = await packageManager.getInstalledVersion('storybook');
      if (storybookVersion) {
        dependencies.push(`@storybook/nextjs-vite@^${storybookVersion}`);
      }
    } catch {
      // If we can't get version, skip this package
    }
  }

  // Get vitest version for proper version specifiers
  const vitestVersionSpecifier = await packageManager.getInstalledVersion('vitest');

  // Check for coverage reporters
  const v8Version = await packageManager.getInstalledVersion('@vitest/coverage-v8');
  const istanbulVersion = await packageManager.getInstalledVersion('@vitest/coverage-istanbul');

  if (!v8Version && !istanbulVersion) {
    dependencies.push('@vitest/coverage-v8');
  }

  // Apply version specifiers to vitest-related packages
  const versionedDependencies = dependencies.map((pkg) => {
    if (pkg.includes('vitest') && vitestVersionSpecifier) {
      return `${pkg}@${vitestVersionSpecifier}`;
    }
    return pkg;
  });

  return versionedDependencies;
}
