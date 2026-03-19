import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { ProjectType } from 'storybook/internal/cli';
import { HandledError, getProjectRoot } from 'storybook/internal/common';
import type { JsPackageManager, PackageJsonWithMaybeDeps } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';
import { NxProjectDetectedError } from 'storybook/internal/server-errors';
import { SupportedLanguage } from 'storybook/internal/types';

import * as find from 'empathic/find';
import semver from 'semver';
import { dedent } from 'ts-dedent';

import type { CommandOptions } from '../generators/types';

type TemplateMatcher = {
  files?: boolean[];
  dependencies?: boolean[];
  peerDependencies?: boolean[];
};

type TemplateConfiguration = {
  preset: ProjectType;
  /** Will be checked both against dependencies and devDependencies */
  dependencies?: string[] | { [dependency: string]: (version: string) => boolean };
  peerDependencies?: string[] | { [dependency: string]: (version: string) => boolean };
  files?: string[];
  matcherFunction: (matcher: TemplateMatcher) => boolean;
};

/** Service encapsulating helpers for ProjectType usage */
export class ProjectTypeService {
  constructor(private readonly jsPackageManager: JsPackageManager) {}

  /** Sorted configuration to match a Storybook preset template */
  getSupportedTemplates(): TemplateConfiguration[] {
    return [
      {
        preset: ProjectType.NUXT,
        dependencies: ['nuxt'],
        matcherFunction: ({ dependencies }) => {
          return dependencies?.every(Boolean) ?? true;
        },
      },
      {
        preset: ProjectType.VUE3,
        dependencies: {
          // This Vue template works with Vue 3
          vue: (versionRange) => versionRange === 'next' || this.eqMajor(versionRange, 3),
        },
        matcherFunction: ({ dependencies }) => {
          return dependencies?.some(Boolean) ?? false;
        },
      },
      {
        preset: ProjectType.EMBER,
        dependencies: ['ember-cli'],
        matcherFunction: ({ dependencies }) => {
          return dependencies?.every(Boolean) ?? true;
        },
      },
      {
        preset: ProjectType.NEXTJS,
        dependencies: ['next'],
        matcherFunction: ({ dependencies }) => {
          return dependencies?.every(Boolean) ?? true;
        },
      },
      {
        preset: ProjectType.QWIK,
        dependencies: ['@builder.io/qwik'],
        matcherFunction: ({ dependencies }) => {
          return dependencies?.every(Boolean) ?? true;
        },
      },
      {
        preset: ProjectType.REACT_NATIVE,
        dependencies: ['react-native', 'react-native-scripts'],
        matcherFunction: ({ dependencies }) => {
          return dependencies?.some(Boolean) ?? false;
        },
      },
      {
        preset: ProjectType.REACT_SCRIPTS,
        // For projects using a custom/forked `react-scripts` package.
        files: ['/node_modules/.bin/react-scripts'],
        // For standard CRA projects
        dependencies: ['react-scripts'],
        matcherFunction: ({ dependencies, files }) => {
          return (dependencies?.every(Boolean) || files?.every(Boolean)) ?? false;
        },
      },
      {
        preset: ProjectType.ANGULAR,
        dependencies: ['@angular/core'],
        matcherFunction: ({ dependencies }) => {
          return dependencies?.every(Boolean) ?? true;
        },
      },
      {
        preset: ProjectType.WEB_COMPONENTS,
        dependencies: ['lit-element', 'lit-html', 'lit'],
        matcherFunction: ({ dependencies }) => {
          return dependencies?.some(Boolean) ?? false;
        },
      },
      {
        preset: ProjectType.PREACT,
        dependencies: ['preact'],
        matcherFunction: ({ dependencies }) => {
          return dependencies?.every(Boolean) ?? true;
        },
      },
      {
        // TODO: This only works because it is before the SVELTE template. could be more explicit
        preset: ProjectType.SVELTEKIT,
        dependencies: ['@sveltejs/kit'],
        matcherFunction: ({ dependencies }) => {
          return dependencies?.every(Boolean) ?? true;
        },
      },
      {
        preset: ProjectType.SVELTE,
        dependencies: ['svelte'],
        matcherFunction: ({ dependencies }) => {
          return dependencies?.every(Boolean) ?? true;
        },
      },
      {
        preset: ProjectType.SOLID,
        dependencies: ['solid-js'],
        matcherFunction: ({ dependencies }) => {
          return dependencies?.every(Boolean) ?? true;
        },
      },
      // DO NOT MOVE ANY TEMPLATES BELOW THIS LINE
      // React is part of every Template, after Storybook is initialized once
      {
        preset: ProjectType.REACT,
        dependencies: ['react'],
        matcherFunction: ({ dependencies }) => {
          return dependencies?.every(Boolean) ?? true;
        },
      },
    ];
  }

  isStorybookInstantiated(configDir = resolve(process.cwd(), '.storybook')) {
    return existsSync(configDir);
  }

  async validateProvidedType(projectTypeProvided: ProjectType): Promise<ProjectType> {
    // Allow only installable types according to core list
    const installable = Object.values(ProjectType).filter(
      (t) => !['undetected', 'unsupported', 'nx'].includes(String(t))
    );
    if (installable.includes(projectTypeProvided)) {
      return projectTypeProvided;
    }
    logger.error(
      `The provided project type ${projectTypeProvided} was not recognized by Storybook`
    );
    throw new HandledError(`Unknown project type supplied: ${projectTypeProvided}`);
  }

  async autoDetectProjectType(options: CommandOptions): Promise<ProjectType> {
    try {
      const detectedType = await this.detectProjectType(options);

      // prompting handled by command layer

      if (detectedType === ProjectType.UNDETECTED || detectedType === null) {
        logger.error(dedent`
          Unable to initialize Storybook in this directory.

          Storybook couldn't detect a supported framework or configuration for your project. Make sure you're inside a framework project (e.g., React, Vue, Svelte, Angular, Next.js) and that its dependencies are installed.

          Tips:
          - Run init in an empty directory or create a new framework app first.
          - If this directory contains unrelated files, try a new directory for Storybook.
        `);
        throw new HandledError('Storybook failed to detect your project type');
      }

      if (detectedType === ProjectType.NX) {
        throw new NxProjectDetectedError();
      }

      return detectedType;
    } catch (err) {
      if (err instanceof HandledError || err instanceof NxProjectDetectedError) {
        throw err;
      }
      logger.error(String(err));
      throw new HandledError(err instanceof Error ? err.message : String(err));
    }
  }

  async detectLanguage(): Promise<SupportedLanguage> {
    let language = SupportedLanguage.JAVASCRIPT;

    if (existsSync('jsconfig.json')) {
      return language;
    }

    const isTypescriptDirectDependency = !!this.jsPackageManager.getAllDependencies().typescript;

    const getModulePackageJSONVersion = async (pkg: string) => {
      return (await this.jsPackageManager.getModulePackageJSON(pkg))?.version ?? null;
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

    if (isTypescriptDirectDependency && typescriptVersion) {
      if (
        satisfies(typescriptVersion, '>=4.9.0') &&
        (!prettierVersion || semver.gte(prettierVersion, '2.8.0')) &&
        (!babelPluginTransformTypescriptVersion ||
          satisfies(babelPluginTransformTypescriptVersion, '>=7.20.0')) &&
        (!typescriptEslintParserVersion || satisfies(typescriptEslintParserVersion, '>=5.44.0')) &&
        (!eslintPluginStorybookVersion || satisfies(eslintPluginStorybookVersion, '>=0.6.8'))
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

  private eqMajor(versionRange: string, major: number) {
    // Uses validRange to avoid a throw from minVersion if an invalid range gets passed
    if (semver.validRange(versionRange)) {
      return semver.minVersion(versionRange)?.major === major;
    }
    return false;
  }

  private async detectProjectType(options: CommandOptions): Promise<ProjectType | null> {
    try {
      if (this.isNxProject()) {
        return ProjectType.NX;
      }
      if (options.html) {
        return ProjectType.HTML;
      }
      const { packageJson } = this.jsPackageManager.primaryPackageJson;
      return this.detectFrameworkPreset(packageJson);
    } catch {
      return ProjectType.UNDETECTED;
    }
  }

  private detectFrameworkPreset(packageJson: PackageJsonWithMaybeDeps): ProjectType | null {
    const result = [...this.getSupportedTemplates(), this.getUnsupportedTemplate()].find(
      (framework) => {
        return this.getProjectType(packageJson, framework) !== null;
      }
    );
    return result ? result.preset : ProjectType.UNDETECTED;
  }

  /** Template that matches unsupported frameworks */
  private getUnsupportedTemplate(): TemplateConfiguration {
    return {
      preset: ProjectType.UNSUPPORTED,
      dependencies: {},
      matcherFunction: ({ dependencies }) => {
        return dependencies?.some(Boolean) ?? false;
      },
    };
  }

  private getProjectType(
    packageJson: PackageJsonWithMaybeDeps,
    framework: TemplateConfiguration
  ): ProjectType | null {
    const matcher: TemplateMatcher = {
      dependencies: [false],
      peerDependencies: [false],
      files: [false],
    };
    const { preset, files, dependencies, peerDependencies, matcherFunction } = framework;

    let dependencySearches: [string, ((version: string) => boolean) | undefined][] = [];

    if (Array.isArray(dependencies)) {
      dependencySearches = dependencies.map((name) => [name, undefined]);
    } else if (typeof dependencies === 'object') {
      dependencySearches = Object.entries(dependencies);
    }

    if (dependencySearches.length > 0) {
      matcher.dependencies = dependencySearches.map(([name, matchFn]) =>
        this.hasDependency(packageJson, name, matchFn)
      );
    }

    let peerDependencySearches: [string, ((version: string) => boolean) | undefined][] = [];

    if (Array.isArray(peerDependencies)) {
      peerDependencySearches = peerDependencies.map((name) => [name, undefined]);
    } else if (typeof peerDependencies === 'object') {
      peerDependencySearches = Object.entries(peerDependencies);
    }

    if (peerDependencySearches.length > 0) {
      matcher.peerDependencies = peerDependencySearches.map(([name, matchFn]) =>
        this.hasPeerDependency(packageJson, name, matchFn)
      );
    }

    if (Array.isArray(files) && files.length > 0) {
      matcher.files = files.map((name) => existsSync(name));
    }

    return matcherFunction(matcher) ? preset : null;
  }

  private hasDependency(
    packageJson: PackageJsonWithMaybeDeps,
    name: string,
    matcher?: (version: string) => boolean
  ) {
    const version = packageJson.dependencies?.[name] || packageJson.devDependencies?.[name];
    if (version && typeof matcher === 'function') {
      return matcher(version);
    }
    return !!version;
  }

  private hasPeerDependency(
    packageJson: PackageJsonWithMaybeDeps,
    name: string,
    matcher?: (version: string) => boolean
  ) {
    const version = packageJson.peerDependencies?.[name];
    if (version && typeof matcher === 'function') {
      return matcher(version);
    }
    return !!version;
  }

  private isNxProject() {
    return find.up('nx.json', { last: getProjectRoot() });
  }
}
