import { configureEslintPlugin, extractEslintInfo } from 'storybook/internal/cli';
import type { JsPackageManager } from 'storybook/internal/common';
import { getPackageDetails, isCI } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';

/** Module for calculating which dependencies need to be installed */
export class DependencyCalculator {
  /** Filter out already installed dependencies */
  filterInstalledPackages(packages: string[], installedDependencies: Set<string>): string[] {
    return packages.filter(
      (packageToInstall) =>
        !installedDependencies.has(getPackageDetails(packageToInstall as string)[0])
    );
  }

  /** Get installed dependencies from package.json */
  getInstalledDependencies(packageManager: JsPackageManager): Set<string> {
    const { packageJson } = packageManager.primaryPackageJson;
    return new Set(Object.keys({ ...packageJson.dependencies, ...packageJson.devDependencies }));
  }

  /** Calculate packages that need to be installed */
  calculatePackagesToInstall(allPackages: string[], packageManager: JsPackageManager): string[] {
    const installedDependencies = this.getInstalledDependencies(packageManager);
    const uniquePackages = [...new Set(allPackages)].filter(Boolean);

    return this.filterInstalledPackages(uniquePackages, installedDependencies);
  }

  /** Configure ESLint plugin if applicable */
  async configureEslintIfNeeded(
    packageManager: JsPackageManager,
    packagesToInstall: string[]
  ): Promise<string | null> {
    if (isCI()) {
      return null;
    }

    try {
      const { hasEslint, isStorybookPluginInstalled, isFlatConfig, eslintConfigFile } =
        await extractEslintInfo(packageManager as any);

      if (hasEslint && !isStorybookPluginInstalled) {
        const eslintPluginPackage = 'eslint-plugin-storybook';
        packagesToInstall.push(eslintPluginPackage);

        await configureEslintPlugin({
          eslintConfigFile,
          packageManager: packageManager as any,
          isFlatConfig,
        });

        return eslintPluginPackage;
      }
    } catch (err) {
      // Any failure regarding configuring the eslint plugin should not fail the whole generator
      logger.warn(`Failed to configure ESLint plugin: ${err}`);
    }

    return null;
  }

  /** Consolidate all packages from different sources */
  consolidatePackages(
    frameworkPackages: string[],
    addonPackages: string[],
    extraPackages: string[],
    installFrameworkPackages: boolean = true
  ): string[] {
    return [
      'storybook',
      ...(installFrameworkPackages ? frameworkPackages : []),
      ...addonPackages,
      ...extraPackages,
    ].filter(Boolean);
  }
}
