import { existsSync } from 'node:fs';

import type { JsPackageManager } from 'storybook/internal/common';
import { SupportedLanguage } from 'storybook/internal/types';

import semver from 'semver';

/** Detect whether the project should be treated as TypeScript or JavaScript. */
export async function detectLanguage(packageManager: JsPackageManager): Promise<SupportedLanguage> {
  let language = SupportedLanguage.JAVASCRIPT;

  if (existsSync('jsconfig.json')) {
    return language;
  }

  const isTypescriptDirectDependency = !!packageManager.getAllDependencies().typescript;

  if (isTypescriptDirectDependency) {
    const incompatibleReasons = await detectIncompatiblePackageVersions(packageManager);
    if (incompatibleReasons.length === 0) {
      language = SupportedLanguage.TYPESCRIPT;
    }
  } else {
    // No direct dependency on TypeScript, but could be a transitive dependency
    // This is eg the case for Nuxt projects, which support a recent version of TypeScript
    // Check for tsconfig.json (https://www.typescriptlang.org/docs/handbook/tsconfig-json.html)
    if (existsSync('tsconfig.json')) {
      language = SupportedLanguage.TYPESCRIPT;
    }
  }

  return language;
}

/** Check installed tooling versions for TypeScript compatibility constraints */
export async function detectIncompatiblePackageVersions(
  packageManager: JsPackageManager
): Promise<string[]> {
  const getModulePackageJSONVersion = async (pkg: string) => {
    return (await packageManager.getModulePackageJSON(pkg))?.version ?? null;
  };

  const [
    typescriptVersion,
    prettierVersion,
    babelPluginTransformTypescriptVersion,
    typescriptEslintParserVersion,
    eslintPluginStorybookVersion,
  ] = await Promise.all([
    getModulePackageJSONVersion('typescript'),
    getModulePackageJSONVersion('prettier'),
    getModulePackageJSONVersion('@babel/plugin-transform-typescript'),
    getModulePackageJSONVersion('@typescript-eslint/parser'),
    getModulePackageJSONVersion('eslint-plugin-storybook'),
  ]);

  const satisfies = (version: string | null, range: string) => {
    if (!version) {
      return false;
    }
    return semver.satisfies(version, range, { includePrerelease: true });
  };

  const incompatibleReasons: string[] = [];

  if (typescriptVersion && !satisfies(typescriptVersion, '>=4.9.0')) {
    incompatibleReasons.push(`typescript ${typescriptVersion} is below 4.9.0`);
  }
  if (prettierVersion && !semver.gte(prettierVersion, '2.8.0')) {
    incompatibleReasons.push(`prettier ${prettierVersion} is below 2.8.0`);
  }
  if (
    babelPluginTransformTypescriptVersion &&
    !satisfies(babelPluginTransformTypescriptVersion, '>=7.20.0')
  ) {
    incompatibleReasons.push(
      `@babel/plugin-transform-typescript ${babelPluginTransformTypescriptVersion} is below 7.20.0`
    );
  }
  if (typescriptEslintParserVersion && !satisfies(typescriptEslintParserVersion, '>=5.44.0')) {
    incompatibleReasons.push(
      `@typescript-eslint/parser ${typescriptEslintParserVersion} is below 5.44.0`
    );
  }
  // Treat Storybook canary/prerelease versions (e.g. 0.0.0-pr-*) as compatible
  if (
    eslintPluginStorybookVersion &&
    !eslintPluginStorybookVersion.startsWith('0.0.0-') &&
    !satisfies(eslintPluginStorybookVersion, '>=0.6.8')
  ) {
    incompatibleReasons.push(
      `eslint-plugin-storybook ${eslintPluginStorybookVersion} is below 0.6.8`
    );
  }

  return incompatibleReasons;
}
