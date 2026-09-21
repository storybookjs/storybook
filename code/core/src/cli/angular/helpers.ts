import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { prompt } from 'storybook/internal/node-logger';
import { MissingAngularJsonError } from 'storybook/internal/server-errors';

import { type FormattingOptions, applyEdits, modify } from 'jsonc-parser';
import semver from 'semver';

export const ANGULAR_JSON_PATH = 'angular.json';

/** Must stay inside the `>=2.0.0` peer range that `@storybook/angular-vite` declares. */
export const ANALOG_VITE_PLUGIN_ANGULAR_VERSION = '^2.5.2';

export const toDevkitVersion = (ngRange?: string | null): string | undefined => {
  if (!ngRange) {
    return undefined;
  }
  const min = semver.validRange(ngRange) ? semver.minVersion(ngRange) : null;

  if (!min) {
    return undefined;
  }
  const pre = min.prerelease.length > 0 ? `-${min.prerelease.join('.')}` : '';
  const versionCore = `0.${min.major * 100 + min.minor}.${min.patch}${pre}`;

  return ngRange.trim().startsWith('^') ? `^${versionCore}` : versionCore;
};

/** A path into a JSON document, e.g. `['projects', 'app', 'architect', 'storybook', 'builder']`. */
export type JSONEditPath = (string | number)[];

// `jsonc-parser` re-indents the lines it touches, so a wrong tab size leaves the document with
// mixed indentation.
const detectIndentation = (text: string): FormattingOptions => {
  const indent = /^[ \t]+(?=[^\s])/m.exec(text)?.[0];

  if (!indent) {
    return { insertSpaces: true, tabSize: 2 };
  }

  return indent.startsWith('\t')
    ? { insertSpaces: false, tabSize: 1 }
    : { insertSpaces: true, tabSize: indent.length };
};

/** Apply a format-preserving edit to a JSON string at `path`. `value === undefined` removes it. */
export const editJsonText = (text: string, path: JSONEditPath, value: unknown): string =>
  applyEdits(text, modify(text, path, value, { formattingOptions: detectIndentation(text) }));

/** An `angular.json` architect target or Nx `project.json` target. */
export interface StorybookBuilderTarget {
  builder?: string;
  executor?: string;
  options?: {
    compodoc?: boolean;
    zoneless?: boolean;
    experimentalZoneless?: boolean;
    [key: string]: unknown;
  };
}

/**
 * Whether `target` runs Storybook, narrowed to `builderPackage` when one is given.
 *
 * `@storybook/angular`, `@storybook/angular-vite` and `@analogjs/storybook-angular` all end in
 * `:start-storybook`, so a caller that edits options one of them owns must pass `builderPackage`.
 */
export const isStorybookTarget = (
  target: unknown,
  builderPackage?: string
): target is StorybookBuilderTarget => {
  if (typeof target !== 'object' || target === null) {
    return false;
  }
  const ref =
    (target as StorybookBuilderTarget).builder ?? (target as StorybookBuilderTarget).executor;
  if (typeof ref !== 'string') {
    return false;
  }
  return ['start-storybook', 'build-storybook'].some((command) =>
    builderPackage ? ref === `${builderPackage}:${command}` : ref.endsWith(`:${command}`)
  );
};

export class AngularJSON {
  json: {
    projects: Record<string, { root: string; projectType: string; architect: Record<string, any> }>;
  };

  private rawText: string;

  private readonly path: string;

  constructor(path: string = ANGULAR_JSON_PATH) {
    if (!existsSync(path)) {
      throw new MissingAngularJsonError({ path: resolve(path) });
    }

    this.path = path;
    this.rawText = readFileSync(path, 'utf8');
    this.json = JSON.parse(this.rawText);
  }

  /** Apply a format-preserving edit at `path` and keep `json` in sync with the result. */
  edit(path: JSONEditPath, value: unknown): void {
    this.rawText = editJsonText(this.rawText, path, value);
    this.json = JSON.parse(this.rawText);
  }

  get projects() {
    return this.json.projects;
  }

  get projectsWithoutStorybook() {
    return Object.keys(this.projects).filter((projectName) => {
      const { architect } = this.projects[projectName];

      return !architect.storybook;
    });
  }

  get hasStorybookBuilder() {
    return Object.keys(this.projects).some((projectName) => {
      const { architect } = this.projects[projectName];
      return Object.keys(architect).some((key) => {
        return (
          architect[key].builder === '@storybook/angular:start-storybook' ||
          architect[key].builder === '@storybook/angular-vite:start-storybook'
        );
      });
    });
  }

  get rootProject() {
    const rootProjectName = Object.keys(this.projects).find((projectName) => {
      const { root } = this.projects[projectName];
      return root === '' || root === '.';
    });

    return rootProjectName ? this.projects[rootProjectName] : null;
  }

  getProjectSettingsByName(projectName: string) {
    return this.projects[projectName];
  }

  async getProjectName() {
    if (this.projectsWithoutStorybook.length > 1) {
      return prompt.select({
        message: 'For which project do you want to generate Storybook configuration?',
        options: this.projectsWithoutStorybook.map((name) => ({
          label: name,
          value: name,
        })),
      });
    }

    return this.projectsWithoutStorybook[0];
  }

  addStorybookEntries({
    angularProjectName,
    storybookFolder,
    useCompodoc,
    root,
    useVite = false,
  }: {
    angularProjectName: string;
    storybookFolder: string;
    useCompodoc: boolean;
    root: string;
    useVite?: boolean;
  }) {
    // add an entry to the angular.json file to setup the storybook builders
    const { architect } = this.projects[angularProjectName];

    const builderPackage = useVite ? '@storybook/angular-vite' : '@storybook/angular';

    const baseOptions = {
      configDir: storybookFolder,
      browserTarget: `${angularProjectName}:build`,
      // Compodoc for the Vite framework is configured in main.ts
      // (framework.options) because the Vite plugin owns it; only the Webpack
      // builder reads Compodoc options from angular.json.
      ...(useVite
        ? {}
        : {
            compodoc: useCompodoc,
            ...(useCompodoc && { compodocArgs: ['-e', 'json', '-d', root || '.'] }),
          }),
    };

    if (!architect.storybook) {
      this.edit(['projects', angularProjectName, 'architect', 'storybook'], {
        builder: `${builderPackage}:start-storybook`,
        options: {
          ...baseOptions,
          port: 6006,
        },
      });
    }

    if (!architect['build-storybook']) {
      this.edit(['projects', angularProjectName, 'architect', 'build-storybook'], {
        builder: `${builderPackage}:build-storybook`,
        options: {
          ...baseOptions,
          outputDir:
            Object.keys(this.projects).length === 1
              ? `storybook-static`
              : `dist/storybook/${angularProjectName}`,
        },
      });
    }
  }

  write() {
    writeFileSync(this.path, this.rawText);
  }
}
