import { bold, gray, grey, white, yellow, underline } from 'chalk';
import dedent from 'ts-dedent';
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
  readonly category = Category.CLI_INIT;

  readonly code = 1;

  public readonly documentation = 'https://nx.dev/packages/storybook';

  template() {
    return dedent`
      We have detected Nx in your project. Nx has its own Storybook initializer, so please use it instead.
      Run "nx g @nx/storybook:configuration" to add Storybook to your project.
    `;
  }
}

export class MissingFrameworkFieldError extends StorybookError {
  readonly category = Category.CORE_COMMON;

  readonly code = 1;

  public readonly documentation =
    'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#new-framework-api';

  template() {
    return dedent`
      Could not find a 'framework' field in Storybook config.

      Please run 'npx storybook automigrate' to automatically fix your config.
    `;
  }
}

export class InvalidFrameworkNameError extends StorybookError {
  readonly category = Category.CORE_COMMON;

  readonly code = 2;

  public readonly documentation =
    'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#new-framework-api';

  constructor(public data: { frameworkName: string }) {
    super();
  }

  template() {
    return dedent`
      Invalid value of '${this.data.frameworkName}' in the 'framework' field of Storybook config.

      Please run 'npx storybook automigrate' to automatically fix your config.
    `;
  }
}

export class CouldNotEvaluateFrameworkError extends StorybookError {
  readonly category = Category.CORE_COMMON;

  readonly code = 3;

  constructor(public data: { frameworkName: string }) {
    super();
  }

  template() {
    return dedent`
      Could not evaluate the '${this.data.frameworkName}' package from the 'framework' field of Storybook config.

      Are you sure it's a valid package and is installed?
    `;
  }
}

// this error is not used anymore, but we keep it to maintain unique its error code
// which is used for telemetry
export class ConflictingStaticDirConfigError extends StorybookError {
  readonly category = Category.CORE_SERVER;

  readonly code = 1;

  public readonly documentation =
    'https://storybook.js.org/docs/react/configure/images-and-assets#serving-static-files-via-storybook-configuration';

  template() {
    return dedent`
      Storybook encountered a conflict when trying to serve statics. You have configured both:
      * Storybook's option in the config file: 'staticDirs'
      * Storybook's (deprecated) CLI flag: '--staticDir' or '-s'
      
      Please remove the CLI flag from your storybook script and use only the 'staticDirs' option instead.
    `;
  }
}
export class InvalidStoriesEntryError extends StorybookError {
  readonly category = Category.CORE_COMMON;

  readonly code = 4;

  public readonly documentation =
    'https://storybook.js.org/docs/react/faq#can-i-have-a-storybook-with-no-local-stories';

  template() {
    return dedent`
      Storybook could not index your stories.
      Your main configuration somehow does not contain a 'stories' field, or it resolved to an empty array.

      Please check your main configuration file and make sure it exports a 'stories' field that is not an empty array.
    `;
  }
}

export class WebpackMissingStatsError extends StorybookError {
  readonly category = Category.BUILDER_WEBPACK5;

  readonly code = 1;

  public documentation = [
    'https://webpack.js.org/configuration/stats/',
    'https://storybook.js.org/docs/react/builders/webpack#configure',
  ];

  template() {
    return dedent`
      No Webpack stats found. Did you turn off stats reporting in your webpack config?
      Storybook needs Webpack stats (including errors) in order to build correctly.
    `;
  }
}

export class WebpackInvocationError extends StorybookError {
  readonly category = Category.BUILDER_WEBPACK5;

  readonly code = 2;

  private errorMessage = '';

  constructor(
    public data: {
      error: Error;
    }
  ) {
    super();
    this.errorMessage = data.error.message;
  }

  template() {
    return this.errorMessage.trim();
  }
}

function removeAnsiEscapeCodes(input = '') {
  return input.replace(/\u001B\[[0-9;]*m/g, '');
}

export class WebpackCompilationError extends StorybookError {
  readonly category = Category.BUILDER_WEBPACK5;

  readonly code = 3;

  constructor(
    public data: {
      errors: {
        message: string;
        stack?: string;
        name?: string;
      }[];
    }
  ) {
    super();

    this.data.errors = data.errors.map((err) => {
      return {
        ...err,
        message: removeAnsiEscapeCodes(err.message),
        stack: removeAnsiEscapeCodes(err.stack),
        name: err.name,
      };
    });
  }

  template() {
    // This error message is a followup of errors logged by Webpack to the user
    return dedent`
      There were problems when compiling your code with Webpack.
      Run Storybook with --debug-webpack for more information.
    `;
  }
}

export class MissingAngularJsonError extends StorybookError {
  readonly category = Category.CLI_INIT;

  readonly code = 2;

  public readonly documentation =
    'https://storybook.js.org/docs/angular/faq#error-no-angularjson-file-found';

  constructor(
    public data: {
      path: string;
    }
  ) {
    super();
  }

  template() {
    return dedent`
      An angular.json file was not found in the current working directory: ${this.data.path}
      Storybook needs it to work properly, so please rerun the command at the root of your project, where the angular.json file is located.
    `;
  }
}

export class AngularLegacyBuildOptionsError extends StorybookError {
  readonly category = Category.FRAMEWORK_ANGULAR;

  readonly code = 1;

  public readonly documentation = [
    'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#angular-drop-support-for-calling-storybook-directly',
    'https://github.com/storybookjs/storybook/tree/next/code/frameworks/angular#how-do-i-migrate-to-an-angular-storybook-builder',
  ];

  template() {
    return dedent`
      Your Storybook startup script uses a solution that is not supported anymore.
      You must use Angular builder to have an explicit configuration on the project used in angular.json.

      Please run 'npx storybook automigrate' to automatically fix your config.
    `;
  }
}

export class CriticalPresetLoadError extends StorybookError {
  readonly category = Category.CORE_SERVER;

  readonly code = 2;

  constructor(
    public data: {
      error: Error;
      presetName: string;
    }
  ) {
    super();
  }

  template() {
    return dedent`
      Storybook failed to load the following preset: ${this.data.presetName}.

      Please check whether your setup is correct, the Storybook dependencies (and their peer dependencies) are installed correctly and there are no package version clashes.

      If you believe this is a bug, please open an issue on Github.

      ${this.data.error.stack || this.data.error.message}
    `;
  }
}

export class MissingBuilderError extends StorybookError {
  readonly category = Category.CORE_SERVER;

  readonly code = 3;

  public readonly documentation = 'https://github.com/storybookjs/storybook/issues/24071';

  template() {
    return dedent`
      Storybook could not find a builder configuration for your project. 
      Builders normally come from a framework package e.g. '@storybook/react-vite', or from builder packages e.g. '@storybook/builder-vite'.
      
      - Does your main config file contain a 'framework' field configured correctly?
      - Is the Storybook framework package installed correctly?
      - If you don't use a framework, does your main config contain a 'core.builder' configured correctly?
      - Are you in a monorepo and perhaps the framework package is hoisted incorrectly?

      If you believe this is a bug, please describe your issue in detail on Github.
    `;
  }
}

export class GoogleFontsDownloadError extends StorybookError {
  readonly category = Category.FRAMEWORK_NEXTJS;

  readonly code = 1;

  public readonly documentation =
    'https://github.com/storybookjs/storybook/blob/next/code/frameworks/nextjs/README.md#nextjs-font-optimization';

  constructor(public data: { fontFamily: string; url: string }) {
    super();
  }

  template() {
    return dedent`
      Failed to fetch \`${this.data.fontFamily}\` from Google Fonts with URL: \`${this.data.url}\`
    `;
  }
}

export class GoogleFontsLoadingError extends StorybookError {
  readonly category = Category.FRAMEWORK_NEXTJS;

  readonly code = 2;

  public readonly documentation =
    'https://github.com/storybookjs/storybook/blob/next/code/frameworks/nextjs/README.md#nextjs-font-optimization';

  constructor(public data: { error: unknown | Error; url: string }) {
    super();
  }

  template() {
    return dedent`
      An error occurred when trying to load Google Fonts with URL \`${this.data.url}\`.
      
      ${this.data.error instanceof Error ? this.data.error.message : ''}
    `;
  }
}

export class NoMatchingExportError extends StorybookError {
  readonly category = Category.CORE_SERVER;

  readonly code = 4;

  constructor(public data: { error: unknown | Error }) {
    super();
  }

  template() {
    return dedent`
      There was an exports mismatch error when trying to build Storybook.
      Please check whether the versions of your Storybook packages match whenever possible, as this might be the cause.
      
      Problematic example:
      { "@storybook/react": "7.5.3", "@storybook/react-vite": "7.4.5", "storybook": "7.3.0" }

      Correct example:
      { "@storybook/react": "7.5.3", "@storybook/react-vite": "7.5.3", "storybook": "7.5.3" }

      Please run \`npx storybook doctor\` for guidance on how to fix this issue.
    `;
  }
}

export class MainFileESMOnlyImportError extends StorybookError {
  readonly category = Category.CORE_SERVER;

  readonly code = 5;

  public documentation =
    'https://github.com/storybookjs/storybook/issues/23972#issuecomment-1948534058';

  constructor(
    public data: { location: string; line: string | undefined; num: number | undefined }
  ) {
    super();
  }

  template() {
    const message = [
      `Storybook failed to load ${this.data.location}`,
      '',
      `It looks like the file tried to load/import an ESM only module.`,
      `Support for this is currently limited in ${this.data.location}`,
      `You can import ESM modules in your main file, but only as dynamic import.`,
      '',
    ];
    if (this.data.line) {
      message.push(
        white(
          `In your ${yellow(this.data.location)} file, line ${bold.cyan(
            this.data.num
          )} threw an error:`
        ),
        grey(this.data.line)
      );
    }

    message.push(
      '',
      white(`Convert the static import to a dynamic import ${underline('where they are used')}.`),
      white(`Example:`) + ' ' + gray(`await import(<your ESM only module>);`),
      ''
    );

    return message.join('\n');
  }
}

export class MainFileMissingError extends StorybookError {
  readonly category = Category.CORE_SERVER;

  readonly code = 6;

  readonly stack = '';

  public readonly documentation = 'https://storybook.js.org/docs/configure';

  constructor(public data: { location: string }) {
    super();
  }

  template() {
    return dedent`
      No configuration files have been found in your configDir: ${yellow(this.data.location)}.
      Storybook needs a "main.js" file, please add it.
      
      You can pass a --config-dir flag to tell Storybook, where your main.js file is located at).
    `;
  }
}

export class MainFileEvaluationError extends StorybookError {
  readonly category = Category.CORE_SERVER;

  readonly code = 7;

  readonly stack = '';

  constructor(public data: { location: string; error: Error }) {
    super();
  }

  template() {
    const errorText = white(
      (this.data.error.stack || this.data.error.message).replaceAll(process.cwd(), '')
    );

    return dedent`
      Storybook couldn't evaluate your ${yellow(this.data.location)} file.

      ${errorText}
    `;
  }
}

export class GenerateNewProjectOnInitError extends StorybookError {
  readonly category = Category.CLI_INIT;

  readonly code = 3;

  constructor(
    public data: { error: unknown | Error; packageManager: string; projectType: string }
  ) {
    super();
  }

  template() {
    return dedent`
      There was an error while using ${this.data.packageManager} to create a new ${
        this.data.projectType
      } project.
      
      ${this.data.error instanceof Error ? this.data.error.message : ''}
      `;
  }
}

export class UpgradeStorybookToLowerVersionError extends StorybookError {
  readonly category = Category.CLI_UPGRADE;

  readonly code = 3;

  constructor(public data: { beforeVersion: string; currentVersion: string }) {
    super();
  }

  template() {
    return dedent`
      You are trying to upgrade Storybook to a lower version than the version currently installed. This is not supported.

      Storybook version ${this.data.beforeVersion} was detected in your project, but you are trying to "upgrade" to version ${this.data.currentVersion}.
      
      This usually happens when running the upgrade command without a version specifier, e.g. "npx storybook upgrade".
      This will cause npm to run the globally cached storybook binary, which might be an older version.

      Instead you should always run the Storybook CLI with a version specifier to force npm to download the latest version:
      
      "npx storybook@latest upgrade"
    `;
  }
}

export class UpgradeStorybookToSameVersionError extends StorybookError {
  readonly category = Category.CLI_UPGRADE;

  readonly code = 4;

  constructor(public data: { beforeVersion: string }) {
    super();
  }

  template() {
    return dedent`
      You are upgrading Storybook to the same version that is currently installed in the project, version ${this.data.beforeVersion}.
      
      This usually happens when running the upgrade command without a version specifier, e.g. "npx storybook upgrade".
      This will cause npm to run the globally cached storybook binary, which might be the same version that you already have.
      This also happens if you're running the Storybook CLI that is locally installed in your project.

      If you intended to upgrade to the latest version, you should always run the Storybook CLI with a version specifier to force npm to download the latest version:

      "npx storybook@latest upgrade"

      If you intended to re-run automigrations, you should run the "automigrate" command directly instead:

      "npx storybook automigrate"
    `;
  }
}

export class UpgradeStorybookUnknownCurrentVersionError extends StorybookError {
  readonly category = Category.CLI_UPGRADE;

  readonly code = 5;

  template() {
    return dedent`
      We couldn't determine the current version of Storybook in your project.

      Are you running the Storybook CLI in a project without Storybook?
      It might help if you specify your Storybook config directory with the --config-dir flag.
    `;
  }
}

export class UpgradeStorybookInWrongWorkingDirectory extends StorybookError {
  readonly category = Category.CLI_UPGRADE;

  readonly code = 6;

  template() {
    return dedent`
      You are running the upgrade command in a CWD that does not contain Storybook dependencies.

      Did you mean to run it in a different directory? Make sure the directory you run this command in contains a package.json with your Storybook dependencies.
    `;
  }
}

export class NoStatsForViteDevError extends StorybookError {
  readonly category = Category.BUILDER_VITE;

  readonly code = 1;

  template() {
    return dedent`
      Unable to write preview stats as the Vite builder does not support stats in dev mode.

      Please remove the \`--stats-json\` flag when running in dev mode.
    `;
  }
}
