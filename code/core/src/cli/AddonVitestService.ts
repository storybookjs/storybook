import fs from 'node:fs/promises';

import * as babel from 'storybook/internal/babel';
import type { JsPackageManager } from 'storybook/internal/common';
import { getProjectRoot } from 'storybook/internal/common';
import { CLI_COLORS } from 'storybook/internal/node-logger';
import { logger, prompt } from 'storybook/internal/node-logger';

import * as find from 'empathic/find';
import { coerce, satisfies } from 'semver';
import { dedent } from 'ts-dedent';

import { SupportedBuilder, SupportedFramework } from '../types';

type Result = {
  compatible: boolean;
  reasons?: string[];
};

export interface AddonVitestCompatibilityOptions {
  packageManager: JsPackageManager;
  builder?: SupportedBuilder;
  framework?: SupportedFramework;
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
  readonly supportedFrameworks: SupportedFramework[] = [
    SupportedFramework.NEXTJS_VITE,
    SupportedFramework.REACT_VITE,
    SupportedFramework.SVELTE_VITE,
    SupportedFramework.VUE3_VITE,
    SupportedFramework.HTML_VITE,
    SupportedFramework.WEB_COMPONENTS_VITE,
    SupportedFramework.SVELTEKIT,
    SupportedFramework.REACT_NATIVE_WEB_VITE,
  ];
  /**
   * Collect all dependencies needed for @storybook/addon-vitest
   *
   * Returns versioned package strings ready for installation:
   *
   * - Base packages: vitest, @vitest/browser, playwright
   * - Next.js specific: @storybook/nextjs-vite
   * - Coverage reporter: @vitest/coverage-v8
   */
  async collectDependencies(packageManager: JsPackageManager): Promise<string[]> {
    const allDeps = packageManager.getAllDependencies();
    const dependencies: string[] = [];

    // Only install these dependencies if they are not already installed
    const basePackages = ['vitest', '@vitest/browser', 'playwright'];
    for (const pkg of basePackages) {
      if (!allDeps[pkg]) {
        dependencies.push(pkg);
      }
    }

    // Check for coverage reporters
    const v8Version = await packageManager.getInstalledVersion('@vitest/coverage-v8');
    const istanbulVersion = await packageManager.getInstalledVersion('@vitest/coverage-istanbul');

    if (!v8Version && !istanbulVersion) {
      dependencies.push('@vitest/coverage-v8');
    }

    // Get vitest version for proper version specifiers
    const vitestVersionSpecifier = await packageManager.getInstalledVersion('vitest');

    // Apply version specifiers to vitest-related packages
    const versionedDependencies = dependencies.map((pkg) => {
      if (pkg.includes('vitest') && vitestVersionSpecifier) {
        return `${pkg}@${vitestVersionSpecifier}`;
      }
      return pkg;
    });

    return versionedDependencies;
  }

  /**
   * Install Playwright browser binaries for @storybook/addon-vitest
   *
   * Installs Chromium with dependencies via `npx playwright install chromium --with-deps`
   *
   * @param packageManager - The package manager to use for installation
   * @param prompt - The prompt instance for displaying progress
   * @param logger - The logger instance for displaying messages
   * @param options - Installation options
   * @returns Array of error messages if installation fails
   */
  async installPlaywright(
    packageManager: JsPackageManager,
    options: { skipInstall?: boolean } = {}
  ): Promise<string[]> {
    const errors: string[] = [];

    // Skip Playwright installation when dependency management is handled externally
    if (options.skipInstall) {
      logger.info(dedent`
        Skipping Playwright installation, please run this command manually:
        ${CLI_COLORS.cta('npx playwright install chromium --with-deps')}
      `);
    } else {
      try {
        const playwrightCommand = ['playwright', 'install', 'chromium', '--with-deps'];
        await prompt.executeTask(
          () =>
            packageManager.executeCommand({
              command: 'npx',
              args: playwrightCommand,
            }),
          {
            id: 'playwright-installation',
            intro: 'Configuring Playwright with Chromium',
            error: `An error occurred while installing Playwright browser binaries. Please run the following command later: ${playwrightCommand.join(' ')}`,
            success: 'Playwright installed successfully',
          }
        );
      } catch (e) {
        if (e instanceof Error) {
          errors.push(e.stack ?? e.message);
        } else {
          errors.push(String(e));
        }
      }
    }

    return errors;
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
    const isFrameworkSupported = this.supportedFrameworks.some(
      (framework) => options.framework === framework
    );

    if (!isFrameworkSupported) {
      reasons.push(`Test feature cannot yet be used with ${options.framework}`);
    }

    // Check package versions
    const packageVersionResult = await this.validatePackageVersions(options.packageManager);
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
  async validatePackageVersions(packageManager: JsPackageManager): Promise<Result> {
    const reasons: string[] = [];

    // Check Vitest version (>=3.0.0 - stricter requirement from postinstall)
    const vitestVersionSpecifier = await packageManager.getInstalledVersion('vitest');
    const coercedVitestVersion = vitestVersionSpecifier ? coerce(vitestVersionSpecifier) : null;

    if (coercedVitestVersion && !satisfies(coercedVitestVersion, '>=3.0.0')) {
      reasons.push(
        `The addon requires Vitest 3.0.0 or higher. You are currently using ${vitestVersionSpecifier}.`
      );
    }

    // Check MSW version (>=2.0.0 if installed)
    const mswVersionSpecifier = await packageManager.getInstalledVersion('msw');
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
      if (!this.isValidWorkspaceConfigFile(fileContents)) {
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
      if (!this.isValidVitestConfig(configContent)) {
        reasons.push(`Found an invalid Vitest config file: ${vitestConfigFile}`);
      }
    }

    return reasons.length > 0 ? { compatible: false, reasons } : { compatible: true };
  }

  // Private helper methods for Vitest config validation

  /** Validate workspace config file structure */
  private isValidWorkspaceConfigFile(fileContents: string): boolean {
    let isValid = false;
    const parsedFile = babel.babelParse(fileContents);

    babel.traverse(parsedFile, {
      ExportDefaultDeclaration: (path: any) => {
        const declaration = path.node.declaration;
        isValid =
          this.isWorkspaceConfigArray(declaration) || this.isDefineWorkspaceExpression(declaration);
      },
    });

    return isValid;
  }

  /** Validate Vitest config file structure */
  private isValidVitestConfig(configContent: string): boolean {
    let isValidConfig = false;
    const parsedConfig = babel.babelParse(configContent);

    babel.traverse(parsedConfig, {
      ExportDefaultDeclaration: (path: any) => {
        if (
          this.isDefineConfigExpression(path.node.declaration) &&
          this.isSafeToExtendWorkspace(path.node.declaration)
        ) {
          isValidConfig = true;
        }
      },
    });

    return isValidConfig;
  }

  private isWorkspaceConfigArray(node: any): boolean {
    return (
      babel.types.isArrayExpression(node) &&
      node?.elements.every(
        (el: any) => babel.types.isStringLiteral(el) || babel.types.isObjectExpression(el)
      )
    );
  }

  private isDefineWorkspaceExpression(node: any): boolean {
    return (
      babel.types.isCallExpression(node) &&
      node.callee &&
      (node.callee as any)?.name === 'defineWorkspace' &&
      this.isWorkspaceConfigArray(node.arguments?.[0])
    );
  }

  private isDefineConfigExpression(node: any): boolean {
    return (
      babel.types.isCallExpression(node) &&
      (node.callee as any)?.name === 'defineConfig' &&
      babel.types.isObjectExpression(node.arguments?.[0])
    );
  }

  private isSafeToExtendWorkspace(node: any): boolean {
    return (
      babel.types.isObjectExpression(node.arguments?.[0]) &&
      node.arguments[0]?.properties.every(
        (p: any) =>
          p.key?.name !== 'test' ||
          (babel.types.isObjectExpression(p.value) &&
            p.value.properties.every(
              ({ key, value }: any) =>
                key?.name !== 'workspace' || babel.types.isArrayExpression(value)
            ))
      )
    );
  }
}
