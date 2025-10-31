import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import type { JsPackageManager, PackageJsonWithMaybeDeps } from 'storybook/internal/common';
import { getProjectRoot } from 'storybook/internal/common';
import { logger, prompt } from 'storybook/internal/node-logger';

import * as find from 'empathic/find';
import semver from 'semver';
import { dedent } from 'ts-dedent';

import { SupportedBuilder } from '../types';
import { isNxProject } from './helpers';
import type { TemplateConfiguration, TemplateMatcher } from './project_types';
import {
  ProjectType,
  SupportedLanguage,
  supportedTemplates,
  unsupportedTemplate,
} from './project_types';

const viteConfigFiles = ['vite.config.ts', 'vite.config.js', 'vite.config.mjs'];
const webpackConfigFiles = ['webpack.config.js'];

const hasDependency = (
  packageJson: PackageJsonWithMaybeDeps,
  name: string,
  matcher?: (version: string) => boolean
) => {
  const version = packageJson.dependencies?.[name] || packageJson.devDependencies?.[name];
  if (version && typeof matcher === 'function') {
    return matcher(version);
  }
  return !!version;
};

const hasPeerDependency = (
  packageJson: PackageJsonWithMaybeDeps,
  name: string,
  matcher?: (version: string) => boolean
) => {
  const version = packageJson.peerDependencies?.[name];
  if (version && typeof matcher === 'function') {
    return matcher(version);
  }
  return !!version;
};

type SearchTuple = [string, ((version: string) => boolean) | undefined];

const getProjectType = (
  packageJson: PackageJsonWithMaybeDeps,
  framework: TemplateConfiguration
): ProjectType | null => {
  const matcher: TemplateMatcher = {
    dependencies: [false],
    peerDependencies: [false],
    files: [false],
  };

  const { preset, files, dependencies, peerDependencies, matcherFunction } = framework;

  let dependencySearches = [] as SearchTuple[];
  if (Array.isArray(dependencies)) {
    dependencySearches = dependencies.map((name) => [name, undefined]);
  } else if (typeof dependencies === 'object') {
    dependencySearches = Object.entries(dependencies);
  }

  // Must check the length so the `[false]` isn't overwritten if `{ dependencies: [] }`
  if (dependencySearches.length > 0) {
    matcher.dependencies = dependencySearches.map(([name, matchFn]) =>
      hasDependency(packageJson, name, matchFn)
    );
  }

  let peerDependencySearches = [] as SearchTuple[];
  if (Array.isArray(peerDependencies)) {
    peerDependencySearches = peerDependencies.map((name) => [name, undefined]);
  } else if (typeof peerDependencies === 'object') {
    peerDependencySearches = Object.entries(peerDependencies);
  }

  // Must check the length so the `[false]` isn't overwritten if `{ peerDependencies: [] }`
  if (peerDependencySearches.length > 0) {
    matcher.peerDependencies = peerDependencySearches.map(([name, matchFn]) =>
      hasPeerDependency(packageJson, name, matchFn)
    );
  }

  if (Array.isArray(files) && files.length > 0) {
    matcher.files = files.map((name) => existsSync(name));
  }

  return matcherFunction(matcher) ? preset : null;
};

export function detectFrameworkPreset(
  packageJson = {} as PackageJsonWithMaybeDeps
): ProjectType | null {
  const result = [...supportedTemplates, unsupportedTemplate].find((framework) => {
    return getProjectType(packageJson, framework) !== null;
  });

  return result ? result.preset : ProjectType.UNDETECTED;
}

/**
 * Attempts to detect which builder to use, by searching for a vite config file or webpack
 * installation. If neither are found it will choose the default builder based on the project type.
 *
 * @returns SupportedBuilder
 */
export async function detectBuilder(packageManager: JsPackageManager) {
  const viteConfig = find.any(viteConfigFiles, { last: getProjectRoot() });
  const webpackConfig = find.any(webpackConfigFiles, { last: getProjectRoot() });
  const dependencies = packageManager.getAllDependencies();

  if (viteConfig || (dependencies.vite && dependencies.webpack === undefined)) {
    return SupportedBuilder.VITE;
  }

  // REWORK
  if (webpackConfig || (dependencies.webpack && dependencies.vite !== undefined)) {
    return SupportedBuilder.WEBPACK5;
  }

  return prompt.select({
    message: dedent`
      We were not able to detect the right builder for your project. 
      Please select one:
      `,
    options: [
      { label: 'Vite', value: SupportedBuilder.VITE },
      { label: 'Webpack 5', value: SupportedBuilder.WEBPACK5 },
    ],
  });
}

export function isStorybookInstantiated(configDir = resolve(process.cwd(), '.storybook')) {
  return existsSync(configDir);
}

// TODO: Remove in SB11
export async function detectPnp() {
  return !!find.any(['.pnp.js', '.pnp.cjs']);
}

export async function detectLanguage(packageManager: JsPackageManager) {
  let language = SupportedLanguage.JAVASCRIPT;

  if (existsSync('jsconfig.json')) {
    return language;
  }

  const isTypescriptDirectDependency = !!packageManager.getAllDependencies().typescript;

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

  if (isTypescriptDirectDependency && typescriptVersion) {
    if (
      semver.gte(typescriptVersion, '4.9.0') &&
      (!prettierVersion || semver.gte(prettierVersion, '2.8.0')) &&
      (!babelPluginTransformTypescriptVersion ||
        semver.gte(babelPluginTransformTypescriptVersion, '7.20.0')) &&
      (!typescriptEslintParserVersion || semver.gte(typescriptEslintParserVersion, '5.44.0')) &&
      (!eslintPluginStorybookVersion || semver.gte(eslintPluginStorybookVersion, '0.6.8'))
    ) {
      language = SupportedLanguage.TYPESCRIPT;
    } else {
      logger.warn(
        'Detected TypeScript < 4.9 or incompatible tooling, populating with JavaScript examples'
      );
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

export async function detect(
  packageManager: JsPackageManager,
  options: { force?: boolean; html?: boolean } = {}
) {
  try {
    if (await isNxProject()) {
      return ProjectType.NX;
    }

    if (options.html) {
      return ProjectType.HTML;
    }

    const { packageJson } = packageManager.primaryPackageJson;
    return detectFrameworkPreset(packageJson);
  } catch {
    return ProjectType.UNDETECTED;
  }
}
