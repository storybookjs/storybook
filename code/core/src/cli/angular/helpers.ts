import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { prompt } from 'storybook/internal/node-logger';
import { MissingAngularJsonError } from 'storybook/internal/server-errors';

export const ANGULAR_JSON_PATH = 'angular.json';

export class AngularJSON {
  json: {
    projects: Record<string, { root: string; projectType: string; architect: Record<string, any> }>;
  };

  constructor() {
    if (!existsSync(ANGULAR_JSON_PATH)) {
      throw new MissingAngularJsonError({ path: join(process.cwd(), ANGULAR_JSON_PATH) });
    }

    const jsonContent = readFileSync(ANGULAR_JSON_PATH, 'utf8');
    this.json = JSON.parse(jsonContent);
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
      architect.storybook = {
        builder: `${builderPackage}:start-storybook`,
        options: {
          ...baseOptions,
          port: 6006,
        },
      };
    }

    if (!architect['build-storybook']) {
      architect['build-storybook'] = {
        builder: `${builderPackage}:build-storybook`,
        options: {
          ...baseOptions,
          outputDir:
            Object.keys(this.projects).length === 1
              ? `storybook-static`
              : `dist/storybook/${angularProjectName}`,
        },
      };
    }
  }

  write() {
    writeFileSync(ANGULAR_JSON_PATH, JSON.stringify(this.json, null, 2));
  }
}
