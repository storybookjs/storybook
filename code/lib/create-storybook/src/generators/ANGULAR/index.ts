import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { AngularJSON, ProjectType, copyTemplate } from 'storybook/internal/cli';
import { logger, prompt } from 'storybook/internal/node-logger';
import { SupportedBuilder, SupportedFramework, SupportedRenderer } from 'storybook/internal/types';

import semver from 'semver';
import { dedent } from 'ts-dedent';

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
    const useCompodoc = context.yes ? true : await promptForCompoDocs();
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

    const toDevkitVersion = (ngRange?: string | null) => {
      if (!ngRange) {
        return undefined;
      }
      const min = semver.minVersion(ngRange);

      if (!min) {
        return undefined;
      }
      const pre = min.prerelease && min.prerelease.length > 0 ? `-${min.prerelease.join('.')}` : '';
      // devkit follows 0.<major*100 + minor>.<patch>
      const devkitMinor = min.major * 100 + min.minor;
      const versionCore = `0.${devkitMinor}.${min.patch}${pre}`;
      const hasCaret = ngRange.trim().startsWith('^');
      return hasCaret ? `^${versionCore}` : versionCore;
    };

    const devkitVersion = toDevkitVersion(angularVersion);

    const extraAngularDeps = [
      angularVersion
        ? `@angular-devkit/build-angular@${angularVersion}`
        : '@angular-devkit/build-angular',
      devkitVersion ? `@angular-devkit/architect@${devkitVersion}` : '@angular-devkit/architect',
      angularVersion ? `@angular-devkit/core@${angularVersion}` : '@angular-devkit/core',
      angularVersion
        ? `@angular/platform-browser-dynamic@${angularVersion}`
        : '@angular/platform-browser-dynamic',
    ];

    return {
      extraPackages: [
        ...extraAngularDeps,
        ...(useCompodoc ? ['@compodoc/compodoc', '@storybook/addon-docs'] : []),
      ],
      addScripts: false, // Handled above based on project count
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

function promptForCompoDocs(): Promise<boolean> {
  logger.log(
    `Compodoc is a great tool to generate documentation for your Angular projects. Storybook can use the documentation generated by Compodoc to extract argument definitions and JSDOC comments to display them in the Storybook UI. We highly recommend using Compodoc for your Angular projects to get the best experience out of Storybook.`
  );

  return prompt.confirm({
    message: 'Do you want to use Compodoc for documentation?',
    initialValue: true,
  });
}
