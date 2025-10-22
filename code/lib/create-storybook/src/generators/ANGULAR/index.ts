import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { AngularJSON, ProjectType, copyTemplate } from 'storybook/internal/cli';
import { logger } from 'storybook/internal/node-logger';
import { SupportedBuilder, SupportedFramework, SupportedRenderer } from 'storybook/internal/types';

import dedent from 'ts-dedent';

import { defineGeneratorModule } from '../modules/GeneratorModule';

export default defineGeneratorModule({
  metadata: {
    projectType: ProjectType.ANGULAR,
    renderer: SupportedRenderer.ANGULAR,
    framework: SupportedFramework.ANGULAR,
    builderOverride: SupportedBuilder.WEBPACK5,
  },
  configure: async (packageManager, context) => {
    const angularJSON = new AngularJSON();

    if (
      !angularJSON.projects ||
      (angularJSON.projects && Object.keys(angularJSON.projects).length === 0)
    ) {
      throw new Error(
        'Storybook was not able to find any projects in your angular.json file. Are you sure this is an Angular CLI project?'
      );
    }

    if (angularJSON.projectsWithoutStorybook.length === 0) {
      throw new Error(
        'Every project in your workspace is already set up with Storybook. There is nothing to do!'
      );
    }

    const angularProjectName = await angularJSON.getProjectName();
    logger.log(`Adding Storybook support to your "${angularProjectName}" project`);

    const angularProject = angularJSON.getProjectSettingsByName(angularProjectName);

    if (!angularProject) {
      throw new Error(
        `Somehow we were not able to retrieve the "${angularProjectName}" project in your angular.json file. This is likely a bug in Storybook, please file an issue.`
      );
    }

    const { root, projectType } = angularProject;
    const { projects } = angularJSON;
    const useCompodoc = context.features.includes('docs');
    const storybookFolder = root ? `${root}/.storybook` : '.storybook';

    angularJSON.addStorybookEntries({
      angularProjectName,
      storybookFolder,
      useCompodoc,
      root,
    });
    angularJSON.write();

    const angularVersion = packageManager.getDependencyVersion('@angular/core');

    // Handle script addition for single-project workspaces
    if (Object.keys(projects).length === 1) {
      packageManager.addScripts({
        storybook: `ng run ${angularProjectName}:storybook`,
        'build-storybook': `ng run ${angularProjectName}:build-storybook`,
      });
    }

    // Copy Angular templates
    let projectTypeValue = projectType || 'application';
    if (projectTypeValue !== 'application' && projectTypeValue !== 'library') {
      projectTypeValue = 'application';
    }

    const templateDir = join(
      dirname(fileURLToPath(import.meta.resolve('create-storybook/package.json'))),
      'templates',
      'angular',
      projectTypeValue
    );

    if (templateDir) {
      copyTemplate(templateDir, root || undefined);
    }

    return {
      extraPackages: [
        angularVersion
          ? `@angular-devkit/build-angular@${angularVersion}`
          : '@angular-devkit/build-angular',
        ...(useCompodoc ? ['@compodoc/compodoc', '@storybook/addon-docs'] : []),
      ],
      addScripts: false, // Handled above based on project count
      addComponents: false, // Handled above via copyTemplate
      componentsDestinationPath: root ? `${root}/src/stories` : undefined,
      storybookConfigFolder: storybookFolder,
      storybookCommand: `ng run ${angularProjectName}:storybook`,
      ...(useCompodoc && {
        frameworkPreviewParts: {
          prefix: dedent`
          import { setCompodocJson } from "@storybook/addon-docs/angular";
          import docJson from "../documentation.json";
          setCompodocJson(docJson);
        `.trimStart(),
        },
      }),
    };
  },
});
