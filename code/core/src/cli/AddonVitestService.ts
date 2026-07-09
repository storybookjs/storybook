import fs from 'node:fs/promises';
import os from 'node:os';

import { canUpdateVitestConfigFile, canUpdateVitestWorkspaceFile } from 'storybook/internal/babel';
import type { JsPackageManager } from 'storybook/internal/common';
import { getProjectRoot } from 'storybook/internal/common';
import { CLI_COLORS } from 'storybook/internal/node-logger';
import { logger, prompt } from 'storybook/internal/node-logger';
import { ErrorCollector } from 'storybook/internal/telemetry';

import * as find from 'empathic/find';
import { coerce, minVersion, satisfies, validRange } from 'semver';
import { dedent } from 'ts-dedent';

import { SupportedBuilder, type SupportedFramework } from '../types/index.ts';
import { SUPPORTED_FRAMEWORKS } from './AddonVitestService.constants.ts';

type Result = {
  compatible: boolean;
  reasons?: string[];
};

export interface AddonVitestCompatibilityOptions {
  builder?: SupportedBuilder;
  framework?: SupportedFramework | null;
  projectRoot?: string;
}

/**
 * Centralized service for @storybook/addon-vitest dependency collection and compatibility
 * validation
 *
 * This service consolidates logic from:
 *
 * - Code/addons/vitest/src/postinstall.ts
 * - Code/lib/create-storybook/src/addon-dependencies/addon-vitest.ts
 * - Code/lib/create-storybook/src/services/FeatureCompatibilityService.ts
 */
export class AddonVitestService {
  constructor(private readonly packageManager: JsPackageManager) {}

  /**
   * Reduce a Vitest version specifier (exact or range) to a single concrete version for
   * `semver.satisfies` comparisons, so dependency collection and postinstall template selection make
   * the same major/minor decision. Uses the lower bound of a valid range, then coerces so a
   * prerelease like `4.0.0-beta.1` is treated as `4.0.0` rather than failing `>=4.0.0`.
   */
  static getComparableVersion(specifier: string | null | undefined): string | undefined {
    if (!specifier) {
      return undefined;
    }
    const range = validRange(specifier);
    return coerce(range ? minVersion(range)?.version : specifier)?.version;
  }

  /**
   * Resolve the Vitest version/range used both to keep the derived `@vitest/*` packages on a
   * compatible major and to select the right config template. Prefers the resolved installed
   * version, then a pnpm catalog entry when vitest is declared as `catalog:` / `catalog:<name>`,
   * then a plain declared semver range. Non-semver protocol specifiers (`workspace:`, an
   * unregistered `catalog:`, ...) resolve to null so they are never copied onto other packages.
   */
  async resolveVitestVersionSpecifier(): Promise<string | null> {
    const declared = this.packageManager.getAllDependencies()['vitest'];

    let specifier = await this.packageManager.getInstalledVersion('vitest');
    if (!specifier && declared) {
      const catalogMatch = declared.match(/^catalog:(.*)$/);
      if (catalogMatch) {
        const catalogName = catalogMatch[1].trim() || undefined;
        specifier = this.packageManager.getCatalogVersion('vitest', catalogName);
      } else if (validRange(declared)) {
        specifier = declared;
      }
    }
    return specifier;
  }

  /**
   * Collect all dependencies needed for @storybook/addon-vitest
   *
   * Returns versioned package strings ready for installation:
   *
   * - Base packages: vitest, @vitest/browser, playwright
   * - Next.js specific: @storybook/nextjs-vite
   * - Coverage reporter: @vitest/coverage-v8
   */
  async collectDependencies(): Promise<string[]> {
    const allDeps = this.packageManager.getAllDependencies();
    const dependencies: string[] = [];

    // Vitest may be declared through a pnpm catalog (`catalog:` or `catalog:<name>`). When it is, the
    // derived `@vitest/*` packages we add must also become catalog entries — copying the raw
    // `catalog:` specifier onto them produces e.g. `@vitest/coverage-v8@catalog:`, which fails
    // install because no such catalog entry exists.
    const catalogMatch = allDeps['vitest']?.match(/^catalog:(.*)$/);
    const catalogName = catalogMatch?.[1]?.trim() || undefined;

    // Resolve the Vitest version/range (catalog-aware) to keep the derived `@vitest/*` packages on a
    // compatible major.
    const vitestVersionSpecifier = await this.resolveVitestVersionSpecifier();

    const versionToCheck = AddonVitestService.getComparableVersion(vitestVersionSpecifier);
    const isVitest4OrNewer = versionToCheck ? satisfies(versionToCheck, '>=4.0.0') : true;

    // only install these dependencies if they are not already installed
    const basePackages = [
      'vitest',
      'playwright',
      isVitest4OrNewer ? '@vitest/browser-playwright' : '@vitest/browser',
    ];

    // Only install these dependencies if they are not already installed
    for (const pkg of basePackages) {
      if (!allDeps[pkg]) {
        dependencies.push(pkg);
      }
    }

    // Check for coverage reporters
    const v8Version = await this.packageManager.getInstalledVersion('@vitest/coverage-v8');
    const istanbulVersion = await this.packageManager.getInstalledVersion(
      '@vitest/coverage-istanbul'
    );

    if (!v8Version && !istanbulVersion) {
      dependencies.push('@vitest/coverage-v8');
    }

    // Apply version specifiers to vitest-related packages.
    const catalogEntries: Record<string, string> = {};
    const versionedDependencies = dependencies.map((pkg) => {
      if (!pkg.includes('vitest') || !vitestVersionSpecifier) {
        return pkg;
      }
      if (catalogMatch) {
        // Mirror the project's catalog convention: reference the catalog from package.json and
        // register the resolved version in pnpm-workspace.yaml below.
        catalogEntries[pkg] = vitestVersionSpecifier;
        return `${pkg}@catalog:${catalogName ?? ''}`;
      }
      return `${pkg}@${vitestVersionSpecifier}`;
    });

    if (Object.keys(catalogEntries).length > 0) {
      this.packageManager.syncWorkspaceCatalog(catalogEntries, catalogName);
    }

    return versionedDependencies;
  }

  /**
   * Install Playwright browser binaries for @storybook/addon-vitest
   *
   * Installs Chromium via `npx playwright install chromium`. In CI environments and on
   * macOS/Windows (officially supported platforms), also installs system-level browser dependencies
   * via `--with-deps`. On other platforms (e.g. Linux), `--with-deps` is omitted to avoid requiring
   * `sudo` — system packages are typically managed by the distro package manager.
   *
   * @param packageManager - The package manager to use for installation
   * @param prompt - The prompt instance for displaying progress
   * @param logger - The logger instance for displaying messages
   * @param options - Installation options
   * @returns Array of error messages if installation fails
   */
  async installPlaywright(
    options: {
      yes?: boolean;
      /** Is set to true if Storybook didn't install the dependencies yet */
      useRemotePkg?: boolean;
    } = {}
  ): Promise<{ errors: string[]; result: 'installed' | 'skipped' | 'aborted' | 'failed' }> {
    const errors: string[] = [];

    const platform = os.platform();
    const useWithDeps = !!process.env.CI || platform === 'darwin' || platform === 'win32';
    const playwrightCommand = useWithDeps
      ? ['playwright', 'install', 'chromium', '--with-deps']
      : ['playwright', 'install', 'chromium'];
    const playwrightCommandString = this.packageManager.getPackageCommand(playwrightCommand);

    let result: 'installed' | 'skipped' | 'aborted' | 'failed';

    if (process.env.STORYBOOK_CLI_SKIP_PLAYWRIGHT_INSTALLATION) {
      result = 'skipped';
      return { errors, result };
    }

    try {
      const shouldBeInstalled = options.yes
        ? true
        : await (async () => {
            logger.log(dedent`
            Playwright browser binaries are necessary for @storybook/addon-vitest. The download can take some time. If you don't want to wait, you can skip the installation and run the following command manually later:
            ${CLI_COLORS.cta(playwrightCommandString)}
            `);
            return prompt.confirm({
              message: 'Do you want to install Playwright with Chromium now?',
              initialValue: true,
            });
          })();

      if (shouldBeInstalled) {
        const processAborted = await prompt.executeTaskWithSpinner(
          (signal) =>
            this.packageManager.runPackageCommand({
              args: playwrightCommand,
              useRemotePkg: options.useRemotePkg,
              stdio: ['inherit', 'pipe', 'pipe'],
              signal,
            }),
          {
            id: 'playwright-installation',
            intro: 'Installing Playwright browser binaries (press "c" to abort)',
            error: `An error occurred while installing Playwright browser binaries. Please run the following command later: ${playwrightCommandString}`,
            success: 'Playwright browser binaries installed successfully',
            abortable: true,
          }
        );
        if (processAborted) {
          result = 'aborted';
        } else {
          result = 'installed';
          if (!useWithDeps) {
            logger.warn(dedent`
              Playwright was installed without system dependencies. Depending on your operating system, you may need to install additional libraries for Playwright to work correctly.
              To check for missing dependencies, run Storybook Test from the Storybook UI — it will report any libraries that need to be installed.
              On MacOS, Windows, Debian and Ubuntu, you can install system dependencies manually by running:
              ${CLI_COLORS.cta(this.packageManager.getPackageCommand(['playwright', 'install', 'chromium', '--with-deps']))}
            `);
          }
        }
      } else {
        logger.warn('Playwright installation skipped');
        result = 'skipped';
      }
    } catch (e) {
      result = 'failed';
      ErrorCollector.addError(e);
      if (e instanceof Error) {
        errors.push(e.stack ?? e.message);
      } else {
        errors.push(String(e));
      }
    }

    return { errors, result };
  }

  /**
   * Validate full compatibility for @storybook/addon-vitest
   *
   * Checks:
   *
   * - Webpack configuration compatibility
   * - Builder compatibility (Vite or Next.js)
   * - Renderer/framework support
   * - Vitest version (>=3.0.0)
   * - MSW version (>=2.0.0 if installed)
   * - Next.js installation (if using @storybook/nextjs)
   * - Vitest config files (if configDir provided)
   */
  async validateCompatibility(options: AddonVitestCompatibilityOptions): Promise<Result> {
    const reasons: string[] = [];

    // Check builder compatibility
    if (options.builder !== SupportedBuilder.VITE) {
      reasons.push('Non-Vite builder is not supported');
    }

    // Check renderer/framework support
    const isFrameworkSupported = SUPPORTED_FRAMEWORKS.some(
      (framework) => options.framework === framework
    );

    if (!isFrameworkSupported) {
      reasons.push(`Test feature cannot yet be used with ${options.framework}`);
    }

    // Check package versions
    const packageVersionResult = await this.validatePackageVersions();
    if (!packageVersionResult.compatible && packageVersionResult.reasons) {
      reasons.push(...packageVersionResult.reasons);
    }

    // Check vitest config files if configDir provided
    if (options.projectRoot) {
      const configResult = await this.validateConfigFiles(options.projectRoot);
      if (!configResult.compatible && configResult.reasons) {
        reasons.push(...configResult.reasons);
      }
    }

    return reasons.length > 0 ? { compatible: false, reasons } : { compatible: true };
  }

  /**
   * Validate package versions for addon-vitest compatibility Public method to allow early
   * validation before framework detection
   */
  async validatePackageVersions(): Promise<Result> {
    const reasons: string[] = [];

    // Check Vitest version (>=3.0.0 - stricter requirement from postinstall)
    const vitestVersionSpecifier = await this.packageManager.getInstalledVersion('vitest');
    const coercedVitestVersion = vitestVersionSpecifier ? coerce(vitestVersionSpecifier) : null;
    const isCanary = coercedVitestVersion?.version.startsWith('0.0.0') ?? false;

    if (coercedVitestVersion && !satisfies(coercedVitestVersion, '>=3.0.0') && !isCanary) {
      reasons.push(
        `The addon requires Vitest 3.0.0 or higher. You are currently using ${vitestVersionSpecifier}.`
      );
    }

    // Check MSW version (>=2.0.0 if installed)
    const mswVersionSpecifier = await this.packageManager.getInstalledVersion('msw');
    const coercedMswVersion = mswVersionSpecifier ? coerce(mswVersionSpecifier) : null;

    if (coercedMswVersion && !satisfies(coercedMswVersion, '>=2.0.0')) {
      reasons.push(
        `The addon uses Vitest behind the scenes, which supports only version 2 and above of MSW. However, we have detected version ${coercedMswVersion.version} in this project.`
      );
    }

    return reasons.length > 0 ? { compatible: false, reasons } : { compatible: true };
  }

  /**
   * Validate vitest config files for addon compatibility
   *
   * Public method that can be used by both postinstall and create-storybook flows
   */
  async validateConfigFiles(directory: string): Promise<Result> {
    const reasons: string[] = [];
    const projectRoot = getProjectRoot();

    // Check workspace files
    const vitestWorkspaceFile = find.any(
      ['ts', 'js', 'json'].flatMap((ex) => [`vitest.workspace.${ex}`, `vitest.projects.${ex}`]),
      { cwd: directory, last: projectRoot }
    );

    if (vitestWorkspaceFile?.endsWith('.json')) {
      reasons.push(`Cannot auto-update JSON workspace file: ${vitestWorkspaceFile}`);
    } else if (vitestWorkspaceFile) {
      const fileContents = await fs.readFile(vitestWorkspaceFile, 'utf8');
      if (!canUpdateVitestWorkspaceFile(fileContents)) {
        reasons.push(`Found an invalid workspace config file: ${vitestWorkspaceFile}`);
      }
    }

    // Check config files
    const vitestConfigFile = find.any(
      ['ts', 'js', 'tsx', 'jsx', 'cts', 'cjs', 'mts', 'mjs'].map((ex) => `vitest.config.${ex}`),
      { cwd: directory, last: projectRoot }
    );

    if (vitestConfigFile?.endsWith('.cts') || vitestConfigFile?.endsWith('.cjs')) {
      reasons.push(`Cannot auto-update CommonJS config file: ${vitestConfigFile}`);
    } else if (vitestConfigFile) {
      const configContent = await fs.readFile(vitestConfigFile, 'utf8');
      if (!canUpdateVitestConfigFile(configContent)) {
        reasons.push(`Found an invalid Vitest config file: ${vitestConfigFile}`);
      }
    }

    return reasons.length > 0 ? { compatible: false, reasons } : { compatible: true };
  }
}
