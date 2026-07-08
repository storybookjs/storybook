import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { prompt } from 'storybook/internal/node-logger';
import { MissingAngularJsonError } from 'storybook/internal/server-errors';

import { applyEdits, modify } from 'jsonc-parser';

export const ANGULAR_JSON_PATH = 'angular.json';

/** A path into a JSON document, e.g. `['projects', 'app', 'architect', 'storybook', 'builder']`. */
export type JSONEditPath = (string | number)[];

const JSON_EDIT_FORMATTING = { insertSpaces: true, tabSize: 2, eol: '\n' } as const;

/**
 * Apply a single format-preserving edit to a JSON string at `path`, returning the new text.
 * Passing `value === undefined` removes the key/element at `path`. Everything outside the
 * touched node (indentation, array density, …) is left byte-for-byte unchanged, unlike a
 * parse-mutate-`JSON.stringify` round trip, which reformats the whole document.
 */
export const editJsonText = (text: string, path: JSONEditPath, value: unknown): string =>
  applyEdits(text, modify(text, path, value, { formattingOptions: JSON_EDIT_FORMATTING }));

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
