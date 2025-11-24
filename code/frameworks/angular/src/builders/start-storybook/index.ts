import { readFileSync } from 'node:fs';

import { getEnvConfig, getProjectRoot, versions } from 'storybook/internal/common';
import { buildDevStandalone, withTelemetry } from 'storybook/internal/core-server';
import { addToGlobalContext } from 'storybook/internal/telemetry';
import type { CLIOptions } from 'storybook/internal/types';
import { logger } from 'storybook/internal/node-logger';

import type {
  BuilderContext,
  BuilderHandlerFn,
  BuilderOutput,
  Target,
  Builder as DevkitBuilder,
} from '@angular-devkit/architect';
import { createBuilder, targetFromTargetString } from '@angular-devkit/architect';
import type {
  BrowserBuilderOptions,
  StylePreprocessorOptions,
} from '@angular-devkit/build-angular';
import type {
  AssetPattern,
  SourceMapUnion,
  StyleElement,
} from '@angular-devkit/build-angular/src/builders/browser/schema';
import type { JsonObject } from '@angular-devkit/core';
import * as find from 'empathic/find';
import * as pkg from 'empathic/package';

import { errorSummary, printErrorDetails } from '../utils/error-handler';
import { runCompodoc } from '../utils/run-compodoc';
import type { StandaloneOptions } from '../utils/standalone-options';
import { VERSION } from '@angular/core';

addToGlobalContext('cliVersion', versions.storybook);

export type StorybookBuilderOptions = JsonObject & {
  browserTarget?: string | null;
  tsConfig?: string;
  compodoc: boolean;
  compodocArgs: string[];
  enableProdMode?: boolean;
  styles?: StyleElement[];
  stylePreprocessorOptions?: StylePreprocessorOptions;
  assets?: AssetPattern[];
  preserveSymlinks?: boolean;
  sourceMap?: SourceMapUnion;
  experimentalZoneless?: boolean;
} & Pick<
    // makes sure the option exists
    CLIOptions,
    | 'port'
    | 'host'
    | 'configDir'
    | 'https'
    | 'sslCa'
    | 'sslCert'
    | 'sslKey'
    | 'smokeTest'
    | 'ci'
    | 'quiet'
    | 'disableTelemetry'
    | 'initialPath'
    | 'open'
    | 'docs'
    | 'debugWebpack'
    | 'webpackStatsJson'
    | 'statsJson'
    | 'loglevel'
    | 'previewUrl'
  >;

export type StorybookBuilderOutput = JsonObject & BuilderOutput & {};

const commandBuilder: BuilderHandlerFn<StorybookBuilderOptions> = async (
  options,
  context
): Promise<BuilderOutput> => {
  const { tsConfig } = await setup(options, context);

  const docTSConfig = find.up('tsconfig.doc.json', {
    cwd: options.configDir,
    last: getProjectRoot(),
  });

  if (options.compodoc) {
    await runCompodoc(
      {
        compodocArgs: [...options.compodocArgs, ...(options.quiet ? ['--silent'] : [])],
        tsconfig: docTSConfig ?? tsConfig,
      },
      context
    );
  }

  getEnvConfig(options, {
    port: 'SBCONFIG_PORT',
    host: 'SBCONFIG_HOSTNAME',
    staticDir: 'SBCONFIG_STATIC_DIR',
    configDir: 'SBCONFIG_CONFIG_DIR',
    ci: 'CI',
  });

  options.port = parseInt(`${options.port}`, 10);

  const {
    browserTarget,
    stylePreprocessorOptions,
    styles,
    ci,
    configDir,
    docs,
    host,
    https,
    port,
    quiet,
    enableProdMode = false,
    smokeTest,
    sslCa,
    sslCert,
    sslKey,
    disableTelemetry,
    assets,
    initialPath,
    open,
    debugWebpack,
    loglevel,
    webpackStatsJson,
    statsJson,
    previewUrl,
    sourceMap = false,
    preserveSymlinks = false,
    experimentalZoneless = !!(VERSION.major && Number(VERSION.major) >= 21),
  } = options;

  const packageJsonPath = pkg.up({ cwd: __dirname });
  const packageJson =
    packageJsonPath != null ? JSON.parse(readFileSync(packageJsonPath, 'utf8')) : null;

  const standaloneOptions: StandaloneOptions = {
    packageJson,
    ci,
    configDir,
    ...(docs ? { docs } : {}),
    host,
    https,
    port,
    quiet,
    enableProdMode,
    smokeTest,
    sslCa,
    sslCert,
    sslKey,
    disableTelemetry,
    angularBrowserTarget: browserTarget,
    angularBuilderContext: context,
    angularBuilderOptions: {
      ...(stylePreprocessorOptions ? { stylePreprocessorOptions } : {}),
      ...(styles ? { styles } : {}),
      ...(assets ? { assets } : {}),
      preserveSymlinks,
      sourceMap,
      experimentalZoneless,
    },
    tsConfig,
    initialPath,
    open,
    debugWebpack,
    webpackStatsJson,
    statsJson,
    loglevel,
    previewUrl,
  };

  const startedPort = await runInstance(standaloneOptions);
  return { success: true, info: { port: startedPort } } as BuilderOutput;
};

export default createBuilder(commandBuilder) as DevkitBuilder<StorybookBuilderOptions & JsonObject>;

async function setup(options: StorybookBuilderOptions, context: BuilderContext) {
  let browserOptions: (JsonObject & BrowserBuilderOptions) | undefined;
  let browserTarget: Target | undefined;

  if (options.browserTarget) {
    browserTarget = targetFromTargetString(options.browserTarget);
    browserOptions = await context.validateOptions<JsonObject & BrowserBuilderOptions>(
      await context.getTargetOptions(browserTarget),
      await context.getBuilderNameForTarget(browserTarget)
    );
  }

  return {
    tsConfig:
      options.tsConfig ??
      find.up('tsconfig.json', { cwd: options.configDir }) ??
      browserOptions.tsConfig,
  };
}
async function runInstance(options: StandaloneOptions) {
  try {
    const { port } = await withTelemetry(
      'dev',
      {
        cliOptions: options,
        presetOptions: { ...options, corePresets: [], overridePresets: [] },
        printError: printErrorDetails,
      },
      () => {
        logger.intro('Starting storybook');
        return buildDevStandalone(options);
      }
    );
    return port;
  } catch (error) {
    const summarized = errorSummary(error);
    throw new Error(String(summarized));
  }
}
