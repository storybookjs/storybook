import fs from 'node:fs/promises';

import * as babel from 'storybook/internal/babel';
import type { Builder, ProjectType } from 'storybook/internal/cli';
import type { JsPackageManager } from 'storybook/internal/common';
import { getProjectRoot } from 'storybook/internal/common';

import * as find from 'empathic/find';
import { coerce, satisfies } from 'semver';

import type { CompatibilityResult } from '../ink/steps/checks/CompatibilityType';
import { CompatibilityType } from '../ink/steps/checks/CompatibilityType';
import type { GeneratorFeature } from '../generators/types';

/** Project types that support the onboarding feature */
export const ONBOARDING_PROJECT_TYPES = [
  'REACT',
  'REACT_SCRIPTS',
  'REACT_NATIVE_WEB',
  'REACT_PROJECT',
  'WEBPACK_REACT',
  'NEXTJS',
  'VUE3',
  'ANGULAR',
] as const;

/** Project types that support the test addon feature */
export const TEST_SUPPORTED_PROJECT_TYPES = [
  'REACT',
  'VUE3',
  'NEXTJS',
  'NUXT',
  'PREACT',
  'SVELTE',
  'SVELTEKIT',
  'WEB_COMPONENTS',
  'REACT_NATIVE_WEB',
] as const;

export interface FeatureCompatibilityResult {
  compatible: boolean;
  reasons?: string[];
}

/** Service for validating feature compatibility with project configurations */
export class FeatureCompatibilityService {
  /** Check if a project type supports onboarding */
  supportsOnboarding(projectType: ProjectType): boolean {
    return ONBOARDING_PROJECT_TYPES.includes(projectType as any);
  }

  /** Check if a project type and builder combination supports test addon */
  supportsTestAddon(projectType: ProjectType, builder: Builder): boolean {
    // Next.js always supports test addon
    if (projectType === 'NEXTJS') {
      return true;
    }

    // Webpack5 builder doesn't support test addon for other frameworks
    if (builder === 'webpack5') {
      return false;
    }

    // Check if project type is in the supported list
    return TEST_SUPPORTED_PROJECT_TYPES.includes(projectType as any);
  }

  /** Validate package versions for test addon compatibility */
  async validatePackageVersions(
    packageManager: JsPackageManager
  ): Promise<FeatureCompatibilityResult> {
    const reasons: string[] = [];

    // Check Vitest version
    const vitestVersionSpecifier = await packageManager.getInstalledVersion('vitest');
    const coercedVitestVersion = vitestVersionSpecifier ? coerce(vitestVersionSpecifier) : null;
    if (coercedVitestVersion && !satisfies(coercedVitestVersion, '>=2.1.0')) {
      reasons.push(`Vitest >=2.1.0 is required, found ${coercedVitestVersion}`);
    }

    // Check MSW version
    const mswVersionSpecifier = await packageManager.getInstalledVersion('msw');
    const coercedMswVersion = mswVersionSpecifier ? coerce(mswVersionSpecifier) : null;
    if (coercedMswVersion && !satisfies(coercedMswVersion, '>=2.0.0')) {
      reasons.push(`Mock Service Worker (msw) >=2.0.0 is required, found ${coercedMswVersion}`);
    }

    return reasons.length > 0 ? { compatible: false, reasons } : { compatible: true };
  }

  /** Validate vitest config files for test addon compatibility */
  async validateVitestConfigFiles(directory: string): Promise<FeatureCompatibilityResult> {
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

  /** Filter features based on project type and builder compatibility */
  filterFeaturesByProjectType(
    features: Set<GeneratorFeature>,
    projectType: ProjectType,
    builder: Builder
  ): Set<GeneratorFeature> {
    const filtered = new Set(features);

    // Remove onboarding if not supported
    if (filtered.has('onboarding') && !this.supportsOnboarding(projectType)) {
      filtered.delete('onboarding');
    }

    // Remove test if not supported
    if (filtered.has('test') && !this.supportsTestAddon(projectType, builder)) {
      filtered.delete('test');
    }

    return filtered;
  }

  /**
   * Validate all compatibility checks for test feature Returns true if all checks pass, false
   * otherwise
   */
  async validateTestFeatureCompatibility(
    packageManager: JsPackageManager,
    directory: string
  ): Promise<FeatureCompatibilityResult> {
    // Check package versions
    const packageVersionsResult = await this.validatePackageVersions(packageManager);
    if (!packageVersionsResult.compatible) {
      return packageVersionsResult;
    }

    // Check vitest config files
    const vitestConfigResult = await this.validateVitestConfigFiles(directory);
    if (!vitestConfigResult.compatible) {
      return vitestConfigResult;
    }

    return { compatible: true };
  }

  // Private helper methods for Vitest config validation

  /** Validate workspace config file structure */
  private isValidWorkspaceConfigFile(fileContents: string): boolean {
    let isValid = false;
    const parsedFile = babel.babelParse(fileContents);

    babel.traverse(parsedFile, {
      ExportDefaultDeclaration(path: any) {
        const declaration = path.node.declaration;
        isValid =
          this.isWorkspaceConfigArray(declaration) ||
          this.isDefineWorkspaceExpression(declaration);
      },
    });

    return isValid;
  }

  /** Validate Vitest config file structure */
  private isValidVitestConfig(configContent: string): boolean {
    let isValidConfig = false;
    const parsedConfig = babel.babelParse(configContent);

    babel.traverse(parsedConfig, {
      ExportDefaultDeclaration(path: any) {
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

  // Helper type guards
  private isCallExpression(node: any): boolean {
    return node?.type === 'CallExpression';
  }

  private isObjectExpression(node: any): boolean {
    return node?.type === 'ObjectExpression';
  }

  private isArrayExpression(node: any): boolean {
    return node?.type === 'ArrayExpression';
  }

  private isStringLiteral(node: any): boolean {
    return node?.type === 'StringLiteral';
  }

  private isWorkspaceConfigArray(node: any): boolean {
    return (
      this.isArrayExpression(node) &&
      node?.elements.every((el: any) => this.isStringLiteral(el) || this.isObjectExpression(el))
    );
  }

  private isDefineWorkspaceExpression(node: any): boolean {
    return (
      this.isCallExpression(node) &&
      node.callee?.name === 'defineWorkspace' &&
      this.isWorkspaceConfigArray(node.arguments?.[0])
    );
  }

  private isDefineConfigExpression(node: any): boolean {
    return (
      this.isCallExpression(node) &&
      node.callee?.name === 'defineConfig' &&
      this.isObjectExpression(node.arguments?.[0])
    );
  }

  private isSafeToExtendWorkspace(node: any): boolean {
    return (
      this.isObjectExpression(node.arguments?.[0]) &&
      node.arguments[0]?.properties.every(
        (p: any) =>
          p.key?.name !== 'test' ||
          (this.isObjectExpression(p.value) &&
            p.value.properties.every(
              ({ key, value }: any) =>
                key?.name !== 'workspace' || this.isArrayExpression(value)
            ))
      )
    );
  }
}
