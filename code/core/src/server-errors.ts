import chalk from 'chalk';
import { dedent } from 'ts-dedent';

import { StorybookError } from './storybook-error';

/**
 * If you can't find a suitable category for your error, create one
 * based on the package name/file path of which the error is thrown.
 * For instance:
 * If it's from @storybook/node-logger, then NODE-LOGGER
 * If it's from a package that is too broad, e.g. @storybook/cli in the init command, then use a combination like CLI_INIT
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
  FRAMEWORK_SVELTE_WEBPACK5 = 'FRAMEWORK_SVELTE-WEBPACK5',
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
      category: Category.CLI_INIT,
      code: 1,
      documentation: 'https://nx.dev/packages/storybook',
      message: dedent`
        We have detected Nx in your project. Nx has its own Storybook initializer, so please use it instead.
        Run "nx g @nx/storybook:configuration" to add Storybook to your project.`,
    });
  }
}

export class MissingFrameworkFieldError extends StorybookError {
  constructor() {
    super({
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
      category: Category.CORE_SERVER,
      code: 1,
      documentation:
        'https://storybook.js.org/docs/react/configure/images-and-assets#serving-static-files-via-storybook-configuration',
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
      category: Category.CORE_COMMON,
      code: 4,
      documentation:
        'https://storybook.js.org/docs/react/faq#can-i-have-a-storybook-with-no-local-stories',
      message: dedent`
        Storybook could not index your stories.
        Your main configuration somehow does not contain a 'stories' field, or it resolved to an empty array.
        
        Please check your main configuration file and make sure it exports a 'stories' field that is not an empty array.`,
    });
  }
}

export class WebpackMissingStatsError extends StorybookError {
  constructor() {
    super({
      category: Category.BUILDER_WEBPACK5,
      code: 1,
      documentation: [
        'https://webpack.js.org/configuration/stats/',
        'https://storybook.js.org/docs/react/builders/webpack#configure',
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
      category: Category.CLI_INIT,
      code: 2,
      documentation: 'https://storybook.js.org/docs/angular/faq#error-no-angularjson-file-found',
      message: dedent`
        An angular.json file was not found in the current working directory: ${data.path}
        Storybook needs it to work properly, so please rerun the command at the root of your project, where the angular.json file is located.`,
    });
  }
}

export class AngularLegacyBuildOptionsError extends StorybookError {
  constructor() {
    super({
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
      category: Category.FRAMEWORK_NEXTJS,
      code: 1,
      documentation:
        'https://github.com/storybookjs/storybook/blob/next/code/frameworks/nextjs/README.md#nextjs-font-optimization',
      message: dedent`
        Failed to fetch \`${data.fontFamily}\` from Google Fonts with URL: \`${data.url}\``,
    });
  }
}

export class GoogleFontsLoadingError extends StorybookError {
  constructor(public data: { error: unknown | Error; url: string }) {
    super({
      category: Category.FRAMEWORK_NEXTJS,
      code: 2,
      documentation:
        'https://github.com/storybookjs/storybook/blob/next/code/frameworks/nextjs/README.md#nextjs-font-optimization',
      message: dedent`
        An error occurred when trying to load Google Fonts with URL \`${data.url}\`.
        
        ${data.error instanceof Error ? data.error.message : ''}`,
    });
  }
}

export class NoMatchingExportError extends StorybookError {
  constructor(public data: { error: unknown | Error }) {
    super({
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

export class MainFileESMOnlyImportError extends StorybookError {
  constructor(
    public data: { location: string; line: string | undefined; num: number | undefined }
  ) {
    const message = [
      `Storybook failed to load ${data.location}`,
      '',
      `It looks like the file tried to load/import an ESM only module.`,
      `Support for this is currently limited in ${data.location}`,
      `You can import ESM modules in your main file, but only as dynamic import.`,
      '',
    ];
    if (data.line) {
      message.push(
        chalk.white(
          `In your ${chalk.yellow(data.location)} file, line ${chalk.bold.cyan(
            data.num
          )} threw an error:`
        ),
        chalk.grey(data.line)
      );
    }

    message.push(
      '',
      chalk.white(
        `Convert the static import to a dynamic import ${chalk.underline('where they are used')}.`
      ),
      chalk.white(`Example:`) + ' ' + chalk.gray(`await import(<your ESM only module>);`),
      ''
    );

    super({
      category: Category.CORE_SERVER,
      code: 5,
      documentation:
        'https://github.com/storybookjs/storybook/issues/23972#issuecomment-1948534058',
      message: message.join('\n'),
    });
  }
}

export class MainFileMissingError extends StorybookError {
  constructor(public data: { location: string }) {
    super({
      category: Category.CORE_SERVER,
      code: 6,
      documentation: 'https://storybook.js.org/docs/configure',
      message: dedent`
        No configuration files have been found in your configDir: ${chalk.yellow(data.location)}.
        Storybook needs a "main.js" file, please add it.
        
        You can pass a --config-dir flag to tell Storybook, where your main.js file is located at).`,
    });
  }
}

export class MainFileEvaluationError extends StorybookError {
  constructor(public data: { location: string; error: Error }) {
    const errorText = chalk.white(
      (data.error.stack || data.error.message).replaceAll(process.cwd(), '')
    );

    super({
      category: Category.CORE_SERVER,
      code: 7,
      message: dedent`
        Storybook couldn't evaluate your ${chalk.yellow(data.location)} file.
        
        Original error:
        ${errorText}`,
    });
  }
}

export class GenerateNewProjectOnInitError extends StorybookError {
  constructor(
    public data: { error: unknown | Error; packageManager: string; projectType: string }
  ) {
    super({
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

export class UpgradeStorybookToLowerVersionError extends StorybookError {
  constructor(public data: { beforeVersion: string; currentVersion: string }) {
    super({
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

export class UpgradeStorybookToSameVersionError extends StorybookError {
  constructor(public data: { beforeVersion: string }) {
    super({
      category: Category.CLI_UPGRADE,
      code: 4,
      message: dedent`
        You are upgrading Storybook to the same version that is currently installed in the project, version ${data.beforeVersion}.
        
        This usually happens when running the upgrade command without a version specifier, e.g. "npx storybook upgrade".
        This will cause npm to run the globally cached storybook binary, which might be the same version that you already have.
        This also happens if you're running the Storybook CLI that is locally installed in your project.
        
        If you intended to upgrade to the latest version, you should always run the Storybook CLI with a version specifier to force npm to download the latest version:
        
        "npx storybook@latest upgrade"
        
        If you intended to re-run automigrations, you should run the "automigrate" command directly instead:
        
        "npx storybook automigrate"`,
    });
  }
}

export class UpgradeStorybookUnknownCurrentVersionError extends StorybookError {
  constructor() {
    super({
      category: Category.CLI_UPGRADE,
      code: 5,
      message: dedent`
        We couldn't determine the current version of Storybook in your project.
        
        Are you running the Storybook CLI in a project without Storybook?
        It might help if you specify your Storybook config directory with the --config-dir flag.`,
    });
  }
}

export class UpgradeStorybookInWrongWorkingDirectory extends StorybookError {
  constructor() {
    super({
      category: Category.CLI_UPGRADE,
      code: 6,
      message: dedent`
        You are running the upgrade command in a CWD that does not contain Storybook dependencies.
        
        Did you mean to run it in a different directory? Make sure the directory you run this command in contains a package.json with your Storybook dependencies.`,
    });
  }
}

export class NoStatsForViteDevError extends StorybookError {
  constructor() {
    super({
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
      category: Category.CLI,
      code: 1,
      message: dedent`
        Unable to find versions of "${data.packageName}" using ${data.packageManager}
        ${data.error && `Reason: ${data.error}`}`,
    });
  }
}
