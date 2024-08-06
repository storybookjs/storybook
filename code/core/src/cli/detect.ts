import * as fs from 'fs';
import { findUpSync } from 'find-up';
import semver from 'semver';
import { logger } from '@storybook/core/node-logger';

import { resolve } from 'node:path';
import prompts from 'prompts';
import type { TemplateConfiguration, TemplateMatcher } from './project_types';
import {
  ProjectType,
  supportedTemplates,
  SupportedLanguage,
  unsupportedTemplate,
  CoreBuilder,
} from './project_types';
import { isNxProject } from './helpers';
import type { JsPackageManager, PackageJsonWithMaybeDeps } from '@storybook/core/common';
import { commandLog, HandledError } from '@storybook/core/common';

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

const getFrameworkPreset = (
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
    matcher.files = files.map((name) => fs.existsSync(name));
  }

  return matcherFunction(matcher) ? preset : null;
};

export function detectFrameworkPreset(
  packageJson = {} as PackageJsonWithMaybeDeps
): ProjectType | null {
  const result = [...supportedTemplates, unsupportedTemplate].find((framework) => {
    return getFrameworkPreset(packageJson, framework) !== null;
  });

  return result ? result.preset : ProjectType.UNDETECTED;
}

/**
 * Attempts to detect which builder to use, by searching for a vite config file or webpack installation.
 * If neither are found it will choose the default builder based on the project type.
 *
 * @returns CoreBuilder
 */
export async function detectBuilder(packageManager: JsPackageManager, projectType: ProjectType) {
  const viteConfig = findUpSync(viteConfigFiles);
  const webpackConfig = findUpSync(webpackConfigFiles);
  const dependencies = await packageManager.getAllDependencies();

  if (viteConfig || (dependencies.vite && dependencies.webpack === undefined)) {
    commandLog('Detected Vite project. Setting builder to Vite')();
    return CoreBuilder.Vite;
  }

  // REWORK
  if (webpackConfig || (dependencies.webpack && dependencies.vite !== undefined)) {
    commandLog('Detected webpack project. Setting builder to webpack')();
    return CoreBuilder.Webpack5;
  }

  // Fallback to Vite or Webpack based on project type
  switch (projectType) {
    case ProjectType.REACT_SCRIPTS:
    case ProjectType.ANGULAR:
    case ProjectType.REACT_NATIVE: // technically react native doesn't use webpack, we just want to set something
    case ProjectType.NEXTJS:
    case ProjectType.EMBER:
      return CoreBuilder.Webpack5;
    default:
      const { builder } = await prompts(
        {
          type: 'select',
          name: 'builder',
          message:
            '\nWe were not able to detect the right builder for your project. Please select one:',
          choices: [
            { title: 'Vite', value: CoreBuilder.Vite },
            { title: 'Webpack 5', value: CoreBuilder.Webpack5 },
          ],
        },
        {
          onCancel: () => {
            throw new HandledError('Canceled by the user');
          },
        }
      );

      return builder;
  }
}

export function isStorybookInstantiated(configDir = resolve(process.cwd(), '.storybook')) {
  return fs.existsSync(configDir);
}

export async function detectPnp() {
  return !!findUpSync(['.pnp.js', '.pnp.cjs']);
}

export async function detectLanguage(packageManager: JsPackageManager) {
  let language = SupportedLanguage.JAVASCRIPT;

  if (fs.existsSync('jsconfig.json')) {
    return language;
  }

  const isTypescriptDirectDependency = await packageManager
    .getAllDependencies()
    .then((deps) => Boolean(deps.typescript));

  const typescriptVersion = await packageManager.getPackageVersion('typescript');
  const prettierVersion = await packageManager.getPackageVersion('prettier');
  const babelPluginTransformTypescriptVersion = await packageManager.getPackageVersion(
    '@babel/plugin-transform-typescript'
  );
  const typescriptEslintParserVersion = await packageManager.getPackageVersion(
    '@typescript-eslint/parser'
  );

  const eslintPluginStorybookVersion =
    await packageManager.getPackageVersion('eslint-plugin-storybook');

  if (isTypescriptDirectDependency && typescriptVersion) {
    if (
      semver.gte(typescriptVersion, '4.9.0') &&
      (!prettierVersion || semver.gte(prettierVersion, '2.8.0')) &&
      (!babelPluginTransformTypescriptVersion ||
        semver.gte(babelPluginTransformTypescriptVersion, '7.20.0')) &&
      (!typescriptEslintParserVersion || semver.gte(typescriptEslintParserVersion, '5.44.0')) &&
      (!eslintPluginStorybookVersion || semver.gte(eslintPluginStorybookVersion, '0.6.8'))
    ) {
      language = SupportedLanguage.TYPESCRIPT_4_9;
    } else if (semver.gte(typescriptVersion, '3.8.0')) {
      language = SupportedLanguage.TYPESCRIPT_3_8;
    } else if (semver.lt(typescriptVersion, '3.8.0')) {
      logger.warn('Detected TypeScript < 3.8, populating with JavaScript examples');
    }
  }

  return language;
}

export async function detect(
  packageManager: JsPackageManager,
  options: { force?: boolean; html?: boolean } = {}
) {
  const packageJson = await packageManager.retrievePackageJson();

  if (!packageJson) {
    return ProjectType.UNDETECTED;
  }

  if (await isNxProject()) {
    return ProjectType.NX;
  }

  if (options.html) {
    return ProjectType.HTML;
  }

  return detectFrameworkPreset(packageJson);
}
