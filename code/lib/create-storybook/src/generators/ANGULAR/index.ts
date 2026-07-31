import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { AngularJSON, ProjectType, copyTemplate } from 'storybook/internal/cli';
import { MIN_SUPPORTED_NODE_VERSIONS } from 'storybook/internal/common';
import { logger, prompt } from 'storybook/internal/node-logger';
import { SupportedBuilder, SupportedFramework, SupportedRenderer } from 'storybook/internal/types';

import semver from 'semver';
import { dedent } from 'ts-dedent';

import { createPromptCancelOptions } from '../../prompt-cancel.ts';
import { defineGeneratorModule } from '../modules/GeneratorModule.ts';

export default defineGeneratorModule({
  metadata: {
    projectType: ProjectType.ANGULAR,
    renderer: SupportedRenderer.ANGULAR,
    framework: (builder: SupportedBuilder) => {
      return builder === SupportedBuilder.VITE
        ? SupportedFramework.ANGULAR_VITE
        : SupportedFramework.ANGULAR;
    },
    builderOverride: async ({ options }) => {
      // In non-interactive contexts (--yes, CI, or no TTY) default to Vite without prompting.
      const isInteractive =
        !options.yes && !process.env.CI && !!process.stdout.isTTY && !!process.stdin.isTTY;

      if (!isInteractive) {
        return SupportedBuilder.VITE;
      }

      logger.info(dedent`
        Storybook has two Angular builder options: Vite and Webpack 5.

        We recommend angular-vite (in preview), which is much faster and more modern.
        The webpack-based @storybook/angular remains available for projects that need it.
      `);

      return prompt.select({
        message: 'Which builder would you like to use?',
        options: [
          {
            label: '@storybook/angular-vite (Vite)',
            value: SupportedBuilder.VITE,
            hint: 'in preview',
          },
          { label: '@storybook/angular (Webpack)', value: SupportedBuilder.WEBPACK5 },
        ],
      });
    },
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

    const isVite = context.builder === SupportedBuilder.VITE;
    const { root, projectType } = angularProject;
    const { projects } = angularJSON;
    const useCompodoc = context.yes ? true : await promptForCompoDocs(context.telemetryService);
    const storybookFolder = root ? `${root}/.storybook` : '.storybook';

    angularJSON.addStorybookEntries({
      angularProjectName,
      storybookFolder,
      useCompodoc,
      root,
      useVite: isVite,
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
      // @storybook/angular-vite renders via bootstrapApplication from @angular/platform-browser,
      // so platform-browser-dynamic is only a peer requirement of the webpack framework.
      ...(isVite
        ? []
        : [
            angularVersion
              ? `@angular/platform-browser-dynamic@${angularVersion}`
              : '@angular/platform-browser-dynamic',
          ]),
    ];

    // pnpm's strict isolation hides transitively-installed `@types/node`, so a fresh Angular
    // project fails to resolve the `node` type definitions its tsconfig references. We pin to the
    // lowest Node major Storybook supports rather than the version that happens to run `init`:
    // the floor is deterministic across machines and guarantees the types never claim APIs newer
    // than what Storybook itself relies on. If the project already declares `@types/node`,
    // baseGenerator skips this entry, so users on newer runtimes keep their own version.
    const minNodeMajor = Math.min(...MIN_SUPPORTED_NODE_VERSIONS.map((v) => v.major));

    const extraPackages = [
      `@types/node@^${minNodeMajor}`,
      ...extraAngularDeps,
      ...(isVite
        ? [
            angularVersion ? `@angular/animations@${angularVersion}` : '@angular/animations',
            '@analogjs/vite-plugin-angular',
            'vite',
          ]
        : []),
      ...(useCompodoc ? ['@compodoc/compodoc', '@storybook/addon-docs'] : []),
    ];

    return {
      extraPackages,
      addScripts: false, // Handled above based on project count
      componentsDestinationPath: root ? `${root}/src/stories` : undefined,
      storybookConfigFolder: storybookFolder,
      storybookCommand: `ng run ${angularProjectName}:storybook`,
      // For the Vite framework, Compodoc is owned by the framework Vite plugin,
      // so it is configured via framework.options in main.ts rather than the
      // angular.json builder. The Webpack framework keeps it in angular.json.
      ...(isVite && {
        frameworkOptions: {
          compodoc: useCompodoc,
          ...(useCompodoc && { compodocArgs: ['-e', 'json', '-d', root || '.'] }),
        },
      }),
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

function promptForCompoDocs(telemetryService: {
  trackPromptCancel: (prompt: string) => Promise<void>;
}): Promise<boolean> {
  logger.log(
    `Compodoc is a great tool to generate documentation for your Angular projects. Storybook can use the documentation generated by Compodoc to extract argument definitions and JSDOC comments to display them in the Storybook UI. We highly recommend using Compodoc for your Angular projects to get the best experience out of Storybook.`
  );

  return prompt.confirm(
    {
      message: 'Do you want to use Compodoc for documentation?',
      initialValue: true,
    },
    createPromptCancelOptions(telemetryService, 'angular-compodoc')
  );
}
