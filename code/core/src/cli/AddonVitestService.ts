import fs from 'node:fs/promises';
import { posix, sep } from 'node:path';

import * as babel from 'storybook/internal/babel';
import type { JsPackageManager } from 'storybook/internal/common';
import { getProjectRoot } from 'storybook/internal/common';

import * as find from 'empathic/find';
import { coerce, satisfies } from 'semver';

type Result = {
  compatible: boolean;
  reasons?: string[];
};

// Import SUPPORTED_FRAMEWORKS from addon constants
const SUPPORTED_FRAMEWORKS = [
  '@storybook/nextjs',
  '@storybook/nextjs-vite',
  '@storybook/react-vite',
  '@storybook/svelte-vite',
  '@storybook/vue3-vite',
  '@storybook/html-vite',
  '@storybook/web-components-vite',
  '@storybook/sveltekit',
  '@storybook/react-native-web-vite',
];

/**
 * Utility function to check if a name matches a pattern Handles both unix and windows path
 * separators
 */
function nameMatches(name: string, pattern: string): boolean {
  if (name === pattern) {
    return true;
  }

  if (name.includes(`${pattern}${sep}`)) {
    return true;
  }
  if (name.includes(`${pattern}${posix.sep}`)) {
    return true;
  }

  return false;
}

export interface AddonVitestCompatibilityOptions {
  packageManager: JsPackageManager;
  frameworkPackageName: string;
  builderPackageName: string;
  hasCustomWebpackConfig?: boolean;
  configDir?: string;
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
  /**
   * Collect all dependencies needed for @storybook/addon-vitest
   *
   * Returns versioned package strings ready for installation:
   *
   * - Base packages: vitest, @vitest/browser, playwright
   * - Next.js specific: @storybook/nextjs-vite
   * - Coverage reporter: @vitest/coverage-v8
   */
  async collectDependencies(
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

    // Add Next.js specific dependency
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

    // Check webpack configuration
    if (options.hasCustomWebpackConfig) {
      reasons.push('The addon cannot be used with a custom Webpack configuration.');
    }

    // Check builder compatibility
    if (
      !nameMatches(options.frameworkPackageName, '@storybook/nextjs') &&
      !nameMatches(options.builderPackageName, '@storybook/builder-vite')
    ) {
      reasons.push('The addon can only be used with a Vite-based Storybook framework or Next.js.');
    }

    // Check renderer/framework support
    const isRendererSupported = SUPPORTED_FRAMEWORKS.some((framework) =>
      nameMatches(options.frameworkPackageName, framework)
    );

    if (!isRendererSupported) {
      reasons.push(`The addon cannot yet be used with ${options.frameworkPackageName}`);
    }

    // Check package versions
    const packageVersionResult = await this.validatePackageVersions(options.packageManager);
    if (!packageVersionResult.compatible && packageVersionResult.reasons) {
      reasons.push(...packageVersionResult.reasons);
    }

    // Check Next.js installation if using Next.js framework
    if (nameMatches(options.frameworkPackageName, '@storybook/nextjs')) {
      const nextjsResult = await this.validateNextjsInstallation(options.packageManager);
      if (!nextjsResult.compatible && nextjsResult.reasons) {
        reasons.push(...nextjsResult.reasons);
      }
    }

    // Check vitest config files if configDir provided
    if (options.configDir) {
      const configResult = await this.validateConfigFiles(options.configDir);
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

  /** Validate that Next.js is installed when using @storybook/nextjs */
  private async validateNextjsInstallation(packageManager: JsPackageManager): Promise<Result> {
    const nextVersion = await packageManager.getInstalledVersion('next');
    if (!nextVersion) {
      return {
        compatible: false,
        reasons: [
          'You are using @storybook/nextjs without having "next" installed. Please install "next" or use a different Storybook framework integration and try again.',
        ],
      };
    }

    return { compatible: true };
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
