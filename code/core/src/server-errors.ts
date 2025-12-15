import picocolors from 'picocolors';
import { dedent } from 'ts-dedent';

import type { Status } from './shared/status-store';
import type { StatusTypeId } from './shared/status-store';
import { StorybookError } from './storybook-error';

export { StorybookError } from './storybook-error';

/**
 * If you can't find a suitable category for your error, create one based on the package name/file
 * path of which the error is thrown. For instance: If it's from `@storybook/node-logger`, then
 * NODE-LOGGER If it's from a package that is too broad, e.g. @storybook/cli in the init command,
 * then use a combination like CLI_INIT
 */
export enum Category {
  CLI = 'CLI',
  CLI_INIT = 'CLI_INIT',
  CLI_AUTOMIGRATE = 'CLI_AUTOMIGRATE',
  CLI_UPGRADE = 'CLI_UPGRADE',
  CLI_ADD = 'CLI_ADD',
  CODEMOD = 'CODEMOD',
  CORE_SERVER = 'CORE-SERVER',
  CSF_PLUGIN = 'CSF-PLUGIN',
  CSF_TOOLS = 'CSF-TOOLS',
  CORE_COMMON = 'CORE-COMMON',
  NODE_LOGGER = 'NODE-LOGGER',
  TELEMETRY = 'TELEMETRY',
  BUILDER_MANAGER = 'BUILDER-MANAGER',
  BUILDER_VITE = 'BUILDER-VITE',
  BUILDER_WEBPACK5 = 'BUILDER-WEBPACK5',
  SOURCE_LOADER = 'SOURCE-LOADER',
  POSTINSTALL = 'POSTINSTALL',
  DOCS_TOOLS = 'DOCS-TOOLS',
  CORE_WEBPACK = 'CORE-WEBPACK',
  FRAMEWORK_ANGULAR = 'FRAMEWORK_ANGULAR',
  FRAMEWORK_EMBER = 'FRAMEWORK_EMBER',
  FRAMEWORK_HTML_VITE = 'FRAMEWORK_HTML-VITE',
  FRAMEWORK_HTML_WEBPACK5 = 'FRAMEWORK_HTML-WEBPACK5',
  FRAMEWORK_NEXTJS = 'FRAMEWORK_NEXTJS',
  FRAMEWORK_PREACT_VITE = 'FRAMEWORK_PREACT-VITE',
  FRAMEWORK_PREACT_WEBPACK5 = 'FRAMEWORK_PREACT-WEBPACK5',
  FRAMEWORK_REACT_VITE = 'FRAMEWORK_REACT-VITE',
  FRAMEWORK_REACT_WEBPACK5 = 'FRAMEWORK_REACT-WEBPACK5',
  FRAMEWORK_SERVER_WEBPACK5 = 'FRAMEWORK_SERVER-WEBPACK5',
  FRAMEWORK_SVELTE_VITE = 'FRAMEWORK_SVELTE-VITE',
  FRAMEWORK_SVELTEKIT = 'FRAMEWORK_SVELTEKIT',
  FRAMEWORK_VUE_VITE = 'FRAMEWORK_VUE-VITE',
  FRAMEWORK_VUE_WEBPACK5 = 'FRAMEWORK_VUE-WEBPACK5',
  FRAMEWORK_VUE3_VITE = 'FRAMEWORK_VUE3-VITE',
  FRAMEWORK_VUE3_WEBPACK5 = 'FRAMEWORK_VUE3-WEBPACK5',
  FRAMEWORK_WEB_COMPONENTS_VITE = 'FRAMEWORK_WEB-COMPONENTS-VITE',
  FRAMEWORK_WEB_COMPONENTS_WEBPACK5 = 'FRAMEWORK_WEB-COMPONENTS-WEBPACK5',
}

export class NxProjectDetectedError extends StorybookError {
  constructor() {
    super({
      name: 'NxProjectDetectedError',
      category: Category.CLI_INIT,
      code: 1,
      documentation: 'https://nx.dev/nx-api/storybook#generating-storybook-configuration',
      message: dedent`
        We have detected Nx in your project. Nx has its own Storybook initializer, so please use it instead.
        Run "nx g @nx/storybook:configuration <your-project-name>" to add Storybook to a given Nx app or lib.`,
    });
  }
}

export class MissingFrameworkFieldError extends StorybookError {
  constructor() {
    super({
      name: 'MissingFrameworkFieldError',
      category: Category.CORE_COMMON,
      code: 1,
      documentation:
        'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#new-framework-api',
      message: dedent`
        Could not find a 'framework' field in Storybook config.
        
        Please run 'npx storybook automigrate' to automatically fix your config.`,
    });
  }
}

export class InvalidFrameworkNameError extends StorybookError {
  constructor(public data: { frameworkName: string }) {
    super({
      name: 'InvalidFrameworkNameError',
      category: Category.CORE_COMMON,
      code: 2,
      documentation:
        'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#new-framework-api',
      message: dedent`
        Invalid value of '${data.frameworkName}' in the 'framework' field of Storybook config.
        
        Please run 'npx storybook automigrate' to automatically fix your config.
      `,
    });
  }
}

export class CouldNotEvaluateFrameworkError extends StorybookError {
  constructor(public data: { frameworkName: string }) {
    super({
      name: 'CouldNotEvaluateFrameworkError',
      category: Category.CORE_COMMON,
      code: 3,
      documentation: '',
      message: dedent`
        Could not evaluate the '${data.frameworkName}' package from the 'framework' field of Storybook config.
        
        Are you sure it's a valid package and is installed?`,
    });
  }
}

// this error is not used anymore, but we keep it to maintain unique its error code
// which is used for telemetry
export class ConflictingStaticDirConfigError extends StorybookError {
  constructor() {
    super({
      name: 'ConflictingStaticDirConfigError',
      category: Category.CORE_SERVER,
      code: 1,
      documentation:
        'https://storybook.js.org/docs/configure/integration/images-and-assets#serving-static-files-via-storybook-configuration',
      message: dedent`
        Storybook encountered a conflict when trying to serve statics. You have configured both:
        * Storybook's option in the config file: 'staticDirs'
        * Storybook's (deprecated) CLI flag: '--staticDir' or '-s'
        
        Please remove the CLI flag from your storybook script and use only the 'staticDirs' option instead.`,
    });
  }
}

export class InvalidStoriesEntryError extends StorybookError {
  constructor() {
    super({
      name: 'InvalidStoriesEntryError',
      category: Category.CORE_COMMON,
      code: 4,
      documentation:
        'https://storybook.js.org/docs/faq#can-i-have-a-storybook-with-no-local-stories',
      message: dedent`
        Storybook could not index your stories.
        Your main configuration does not contain a 'stories' field, or it resolved to an empty array.
        
        Please check your main configuration file and make sure it exports a 'stories' field that is not an empty array.`,
    });
  }
}

export class WebpackMissingStatsError extends StorybookError {
  constructor() {
    super({
      name: 'WebpackMissingStatsError',
      category: Category.BUILDER_WEBPACK5,
      code: 1,
      documentation: [
        'https://webpack.js.org/configuration/stats/',
        'https://storybook.js.org/docs/builders/webpack#configure',
      ],
      message: dedent`
        No Webpack stats found. Did you turn off stats reporting in your Webpack config?
        Storybook needs Webpack stats (including errors) in order to build correctly.`,
    });
  }
}

export class WebpackInvocationError extends StorybookError {
  constructor(
    public data: {
      error: Error;
    }
  ) {
    super({
      name: 'WebpackInvocationError',
      category: Category.BUILDER_WEBPACK5,
      code: 2,
      message: data.error.message.trim(),
    });
  }
}

function removeAnsiEscapeCodes(input = '') {
  return input.replace(/\u001B\[[0-9;]*m/g, '');
}

export class WebpackCompilationError extends StorybookError {
  constructor(
    public data: {
      errors: {
        message: string;
        stack?: string;
        name?: string;
      }[];
    }
  ) {
    data.errors = data.errors.map((err) => {
      return {
        ...err,
        message: removeAnsiEscapeCodes(err.message),
        stack: removeAnsiEscapeCodes(err.stack),
        name: err.name,
      };
    });

    super({
      name: 'WebpackCompilationError',
      category: Category.BUILDER_WEBPACK5,
      code: 3,
      // This error message is a followup of errors logged by Webpack to the user
      message: dedent`
        There were problems when compiling your code with Webpack.
        Run Storybook with --debug-webpack for more information.
      `,
    });
  }
}

export class MissingAngularJsonError extends StorybookError {
  constructor(
    public data: {
      path: string;
    }
  ) {
    super({
      name: 'MissingAngularJsonError',
      category: Category.CLI_INIT,
      code: 2,
      documentation: 'https://storybook.js.org/docs/faq#error-no-angularjson-file-found?ref=error',
      message: dedent`
        An angular.json file was not found in the current working directory: ${data.path}
        Storybook needs it to work properly, so please rerun the command at the root of your project, where the angular.json file is located.`,
    });
  }
}

export class AngularLegacyBuildOptionsError extends StorybookError {
  constructor() {
    super({
      name: 'AngularLegacyBuildOptionsError',
      category: Category.FRAMEWORK_ANGULAR,
      code: 1,
      documentation: [
        'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#angular-drop-support-for-calling-storybook-directly',
        'https://github.com/storybookjs/storybook/tree/next/code/frameworks/angular#how-do-i-migrate-to-an-angular-storybook-builder',
      ],
      message: dedent`
        Your Storybook startup script uses a solution that is not supported anymore.
        You must use Angular builder to have an explicit configuration on the project used in angular.json.
        
        Please run 'npx storybook automigrate' to automatically fix your config.`,
    });
  }
}

export class CriticalPresetLoadError extends StorybookError {
  constructor(
    public data: {
      error: Error;
      presetName: string;
    }
  ) {
    super({
      name: 'CriticalPresetLoadError',
      category: Category.CORE_SERVER,
      code: 2,
      documentation: '',
      message: dedent`
        Storybook failed to load the following preset: ${data.presetName}.
        
        Please check whether your setup is correct, the Storybook dependencies (and their peer dependencies) are installed correctly and there are no package version clashes.
        
        If you believe this is a bug, please open an issue on Github.
        
        ${data.error.stack || data.error.message}`,
    });
  }
}

export class MissingBuilderError extends StorybookError {
  constructor() {
    super({
      name: 'MissingBuilderError',
      category: Category.CORE_SERVER,
      code: 3,
      documentation: 'https://github.com/storybookjs/storybook/issues/24071',
      message: dedent`
        Storybook could not find a builder configuration for your project. 
        Builders normally come from a framework package e.g. '@storybook/react-vite', or from builder packages e.g. '@storybook/builder-vite'.
        
        - Does your main config file contain a 'framework' field configured correctly?
        - Is the Storybook framework package installed correctly?
        - If you don't use a framework, does your main config contain a 'core.builder' configured correctly?
        - Are you in a monorepo and perhaps the framework package is hoisted incorrectly?
        
        If you believe this is a bug, please describe your issue in detail on Github.`,
    });
  }
}

export class GoogleFontsDownloadError extends StorybookError {
  constructor(public data: { fontFamily: string; url: string }) {
    super({
      name: 'GoogleFontsDownloadError',
      category: Category.FRAMEWORK_NEXTJS,
      code: 1,
      documentation:
        'https://storybook.js.org/docs/get-started/frameworks/nextjs#nextjs-font-optimization',
      message: dedent`
        Failed to fetch \`${data.fontFamily}\` from Google Fonts with URL: \`${data.url}\``,
    });
  }
}

export class GoogleFontsLoadingError extends StorybookError {
  constructor(public data: { error: unknown | Error; url: string }) {
    super({
      name: 'GoogleFontsLoadingError',
      category: Category.FRAMEWORK_NEXTJS,
      code: 2,
      documentation:
        'https://storybook.js.org/docs/get-started/frameworks/nextjs#nextjs-font-optimization',
      message: dedent`
        An error occurred when trying to load Google Fonts with URL \`${data.url}\`.
        
        ${data.error instanceof Error ? data.error.message : ''}`,
    });
  }
}

export class SvelteViteWithSvelteKitError extends StorybookError {
  constructor() {
    super({
      name: 'SvelteViteWithSvelteKitError',
      category: Category.FRAMEWORK_SVELTE_VITE,
      code: 1,
      documentation:
        'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#sveltekit-needs-the-storybooksveltekit-framework',
      message: dedent`
        We've detected a SvelteKit project using the @storybook/svelte-vite framework, which is not supported.
        Please use the @storybook/sveltekit framework instead.`,
    });
  }
}

export class NoMatchingExportError extends StorybookError {
  constructor(public data: { error: unknown | Error }) {
    super({
      name: 'NoMatchingExportError',
      category: Category.CORE_SERVER,
      code: 4,
      documentation: '',
      message: dedent`
        There was an exports mismatch error when trying to build Storybook.
        Please check whether the versions of your Storybook packages match whenever possible, as this might be the cause.
        
        Problematic example:
        { "@storybook/react": "7.5.3", "@storybook/react-vite": "7.4.5", "storybook": "7.3.0" }
        
        Correct example:
        { "@storybook/react": "7.5.3", "@storybook/react-vite": "7.5.3", "storybook": "7.5.3" }
        
        Please run \`npx storybook doctor\` for guidance on how to fix this issue.`,
    });
  }
}

export class MainFileMissingError extends StorybookError {
  constructor(public data: { location: string; source?: 'storybook' | 'vitest' }) {
    const map = {
      storybook: {
        helperMessage:
          'You can pass a --config-dir flag to tell Storybook, where your main.js|ts file is located at.',
        documentation: 'https://storybook.js.org/docs/configure?ref=error',
      },
      vitest: {
        helperMessage:
          'You can pass a configDir plugin option to tell where your main.js|ts file is located at.',
        // TODO: add proper docs once available
        documentation: 'https://storybook.js.org/docs/configure?ref=error',
      },
    };
    const { documentation, helperMessage } = map[data.source || 'storybook'];
    super({
      name: 'MainFileMissingError',
      category: Category.CORE_SERVER,
      code: 6,
      documentation,
      message: dedent`
        No configuration files have been found in your configDir: ${picocolors.yellow(data.location)}.
        Storybook needs a "main.js|ts" file, please add it.
        
        ${helperMessage}`,
    });
  }
}

export class MainFileEvaluationError extends StorybookError {
  constructor(public data: { location: string; error: Error }) {
    const errorText = picocolors.white(
      (data.error.stack || data.error.message).replaceAll(process.cwd(), '')
    );

    super({
      name: 'MainFileEvaluationError',
      category: Category.CORE_SERVER,
      code: 7,
      message: dedent`
        Storybook couldn't evaluate your ${picocolors.yellow(data.location)} file.
        
        Original error:
        ${errorText}`,
    });
  }
}

export class StatusTypeIdMismatchError extends StorybookError {
  constructor(
    public data: {
      status: Status;
      typeId: StatusTypeId;
    }
  ) {
    super({
      name: 'StatusTypeIdMismatchError',
      category: Category.CORE_SERVER,
      code: 16,
      message: `Status has typeId "${data.status.typeId}" but was added to store with typeId "${data.typeId}". Full status: ${JSON.stringify(
        data.status,
        null,
        2
      )}`,
    });
  }
}

export class GenerateNewProjectOnInitError extends StorybookError {
  constructor(
    public data: { error: unknown | Error; packageManager: string; projectType: string }
  ) {
    super({
      name: 'GenerateNewProjectOnInitError',
      category: Category.CLI_INIT,
      code: 3,
      documentation: '',
      message: dedent`
        There was an error while using ${data.packageManager} to create a new ${
          data.projectType
        } project.
        
        ${data.error instanceof Error ? data.error.message : ''}`,
    });
  }
}

export class AddonVitestPostinstallPrerequisiteCheckError extends StorybookError {
  constructor(public data: { reasons: string[] }) {
    super({
      name: 'AddonVitestPostinstallPrerequisiteCheckError',
      category: Category.CLI_INIT,
      isHandledError: true,
      code: 4,
      documentation: '',
      message: 'The prerequisite check for the Vitest addon failed.',
    });
  }
}

export class AddonVitestPostinstallFailedAddonA11yError extends StorybookError {
  constructor(public data: { error: unknown | Error }) {
    super({
      name: 'AddonVitestPostinstallFailedAddonA11yError',
      message: "The @storybook/addon-a11y couldn't be set up for the Vitest addon",
      category: Category.CLI_INIT,
      isHandledError: true,
      code: 6,
    });
  }
}

export class AddonVitestPostinstallExistingSetupFileError extends StorybookError {
  constructor(public data: { filePath: string }) {
    super({
      name: 'AddonVitestPostinstallExistingSetupFileError',
      category: Category.CLI_INIT,
      isHandledError: true,
      code: 7,
      documentation: `https://storybook.js.org/docs/writing-tests/integrations/vitest-addon#manual-setup-advanced`,
      message: dedent`
        Found an existing Vitest setup file: ${data.filePath}
        Please refer to the documentation to complete the setup manually.
      `,
    });
  }
}

export class AddonVitestPostinstallWorkspaceUpdateError extends StorybookError {
  constructor(public data: { filePath: string }) {
    super({
      name: 'AddonVitestPostinstallWorkspaceUpdateError',
      category: Category.CLI_INIT,
      isHandledError: true,
      code: 8,
      documentation: `https://storybook.js.org/docs/writing-tests/integrations/vitest-addon#manual-setup-advanced`,
      message: dedent`
        Could not update existing Vitest workspace file: ${data.filePath}
        Please refer to the documentation to complete the setup manually.
      `,
    });
  }
}

export class AddonVitestPostinstallConfigUpdateError extends StorybookError {
  constructor(public data: { filePath: string }) {
    super({
      name: 'AddonVitestPostinstallConfigUpdateError',
      category: Category.CLI_INIT,
      isHandledError: true,
      code: 9,
      documentation: `https://storybook.js.org/docs/writing-tests/integrations/vitest-addon#manual-setup-advanced`,
      message: dedent`
        Unable to update existing Vitest config file: ${data.filePath}
        Please refer to the documentation to complete the setup manually.
      `,
    });
  }
}

export class AddonVitestPostinstallError extends StorybookError {
  constructor(public data: { errors: StorybookError[] }) {
    super({
      name: 'AddonVitestPostinstallError',
      category: Category.CLI_INIT,
      isHandledError: true,
      code: 5,
      message: 'The Vitest addon setup failed.',
      subErrors: data.errors,
    });
  }
}

export class UpgradeStorybookToLowerVersionError extends StorybookError {
  constructor(public data: { beforeVersion: string; currentVersion: string }) {
    super({
      name: 'UpgradeStorybookToLowerVersionError',
      category: Category.CLI_UPGRADE,
      code: 3,
      message: dedent`
        You are trying to upgrade Storybook to a lower version than the version currently installed. This is not supported.
        
        Storybook version ${data.beforeVersion} was detected in your project, but you are trying to "upgrade" to version ${data.currentVersion}.
        
        This usually happens when running the upgrade command without a version specifier, e.g. "npx storybook upgrade".
        This will cause npm to run the globally cached storybook binary, which might be an older version.
        
        Instead you should always run the Storybook CLI with a version specifier to force npm to download the latest version:
        
        "npx storybook@latest upgrade"`,
    });
  }
}

export class UpgradeStorybookUnknownCurrentVersionError extends StorybookError {
  constructor() {
    super({
      name: 'UpgradeStorybookUnknownCurrentVersionError',
      category: Category.CLI_UPGRADE,
      code: 5,
      message: dedent`
        We couldn't determine the current version of Storybook in your project.
        
        Are you running the Storybook CLI in a project without Storybook?
        It might help if you specify your Storybook config directory with the --config-dir flag.`,
    });
  }
}

export class NoStatsForViteDevError extends StorybookError {
  constructor() {
    super({
      name: 'NoStatsForViteDevError',
      category: Category.BUILDER_VITE,
      code: 1,
      message: dedent`
        Unable to write preview stats as the Vite builder does not support stats in dev mode.
        
        Please remove the \`--stats-json\` flag when running in dev mode.`,
    });
  }
}

export class FindPackageVersionsError extends StorybookError {
  constructor(
    public data: { error: Error | unknown; packageName: string; packageManager: string }
  ) {
    super({
      name: 'FindPackageVersionsError',
      category: Category.CLI,
      code: 1,
      message: dedent`
        Unable to find versions of "${data.packageName}" using ${data.packageManager}
        ${data.error && `Reason: ${data.error}`}`,
    });
  }
}

export class IncompatiblePostCssConfigError extends StorybookError {
  constructor(public data: { error: Error }) {
    super({
      name: 'IncompatiblePostCssConfigError',
      category: Category.FRAMEWORK_NEXTJS,
      code: 3,
      message: dedent`
        Incompatible PostCSS configuration format detected.

        Next.js uses an array-based format for plugins which is not compatible with Vite:
        
        // ❌ Incompatible format (used by Next.js)
        const config = {
          plugins: ["@tailwindcss/postcss"],
        };
        
        Please transform your PostCSS config to use the object-based format, which is compatible with Next.js and Vite:
        
        // ✅ Compatible format (works with Next.js and Vite)
        const config = {
          plugins: {
            "@tailwindcss/postcss": {},
          },
        };
        
        Original error: ${data.error.message}
      `,
    });
  }
}

export class SavingGlobalSettingsFileError extends StorybookError {
  constructor(public data: { filePath: string; error: Error | unknown }) {
    super({
      name: 'SavingGlobalSettingsFileError',
      category: Category.CORE_SERVER,
      code: 1,
      message: dedent`
        Unable to save global settings file to ${data.filePath}
        ${data.error && `Reason: ${data.error}`}`,
    });
  }
}

export class CommonJsConfigNotSupportedError extends StorybookError {
  constructor() {
    super({
      name: 'CommonJsConfigNotSupportedError',
      category: Category.CLI_AUTOMIGRATE,
      code: 1,
      documentation: 'https://storybook.js.org/docs/configure/overview?ref=error#es-modules',
      message: dedent`
        Support for CommonJS Storybook config files has been removed in Storybook 10.0.0.
        Please migrate your config to a valid ESM file.
        
        CommonJS files (ending in .cjs, .cts, .cjsx, .ctsx) or files containing 'module.exports' are no longer supported.
        Please convert your config to use ES modules (import/export syntax).`,
    });
  }
}

export class AutomigrateError extends StorybookError {
  constructor(public data: { errors: Array<Error | unknown> }) {
    super({
      name: 'AutomigrateError',
      category: Category.CLI_AUTOMIGRATE,
      code: 2,
      message: dedent`
        An error occurred while running the automigrate command.
      `,
    });
  }
}
