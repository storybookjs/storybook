import { getEnvConfig, versions } from 'storybook/internal/common';
import { buildStaticStandalone, withTelemetry } from 'storybook/internal/core-server';
import { addToGlobalContext } from 'storybook/internal/telemetry';
import { CLIOptions } from 'storybook/internal/types';

import {
  BuilderContext,
  BuilderHandlerFn,
  BuilderOutput,
  BuilderOutputLike,
  Target,
  createBuilder,
  targetFromTargetString,
} from '@angular-devkit/architect';
import { BrowserBuilderOptions, StylePreprocessorOptions } from '@angular-devkit/build-angular';
import {
  AssetPattern,
  SourceMapUnion,
  StyleElement,
} from '@angular-devkit/build-angular/src/builders/browser/schema';
import { JsonObject } from '@angular-devkit/core';
import { findPackageSync } from 'fd-package-json';
import { sync as findUpSync } from 'find-up';
import { from, of, throwError } from 'rxjs';
import { catchError, map, mapTo, switchMap } from 'rxjs/operators';

import { errorSummary, printErrorDetails } from '../utils/error-handler';
import { runCompodoc } from '../utils/run-compodoc';
import { StandaloneOptions } from '../utils/standalone-options';

addToGlobalContext('cliVersion', versions.storybook);

export type StorybookBuilderOptions = JsonObject & {
  browserTarget?: string | null;
  tsConfig?: string;
  test: boolean;
  docs: boolean;
  compodoc: boolean;
  compodocArgs: string[];
  enableProdMode?: boolean;
  styles?: StyleElement[];
  stylePreprocessorOptions?: StylePreprocessorOptions;
  preserveSymlinks?: boolean;
  assets?: AssetPattern[];
  sourceMap?: SourceMapUnion;
} & Pick<
    // makes sure the option exists
    CLIOptions,
    | 'outputDir'
    | 'configDir'
    | 'loglevel'
    | 'quiet'
    | 'test'
    | 'webpackStatsJson'
    | 'statsJson'
    | 'disableTelemetry'
    | 'debugWebpack'
    | 'previewUrl'
  >;

export type StorybookBuilderOutput = JsonObject & BuilderOutput & { [key: string]: any };

type StandaloneBuildOptions = StandaloneOptions & { outputDir: string };

const commandBuilder: BuilderHandlerFn<StorybookBuilderOptions> = (
  options,
  context
): BuilderOutputLike => {
  const builder = from(setup(options, context)).pipe(
    switchMap(({ tsConfig }) => {
      const docTSConfig = findUpSync('tsconfig.doc.json', { cwd: options.configDir });
      const runCompodoc$ = options.compodoc
        ? runCompodoc(
            { compodocArgs: options.compodocArgs, tsconfig: docTSConfig ?? tsConfig },
            context
          ).pipe(mapTo({ tsConfig }))
        : of({});

      return runCompodoc$.pipe(mapTo({ tsConfig }));
    }),
    map(({ tsConfig }) => {
      getEnvConfig(options, {
        staticDir: 'SBCONFIG_STATIC_DIR',
        outputDir: 'SBCONFIG_OUTPUT_DIR',
        configDir: 'SBCONFIG_CONFIG_DIR',
      });

      const {
        browserTarget,
        stylePreprocessorOptions,
        styles,
        configDir,
        docs,
        loglevel,
        test,
        outputDir,
        quiet,
        enableProdMode = true,
        webpackStatsJson,
        statsJson,
        debugWebpack,
        disableTelemetry,
        assets,
        previewUrl,
        sourceMap = false,
        preserveSymlinks = false,
      } = options;

      const standaloneOptions: StandaloneBuildOptions = {
        packageJson: findPackageSync(__dirname),
        configDir,
        ...(docs ? { docs } : {}),
        loglevel,
        outputDir,
        test,
        quiet,
        enableProdMode,
        disableTelemetry,
        angularBrowserTarget: browserTarget,
        angularBuilderContext: context,
        angularBuilderOptions: {
          ...(stylePreprocessorOptions ? { stylePreprocessorOptions } : {}),
          ...(styles ? { styles } : {}),
          ...(assets ? { assets } : {}),
          sourceMap,
          preserveSymlinks,
        },
        tsConfig,
        webpackStatsJson,
        statsJson,
        debugWebpack,
        previewUrl,
      };

      return standaloneOptions;
    }),
    switchMap((standaloneOptions) => runInstance({ ...standaloneOptions, mode: 'static' })),
    map(() => {
      return { success: true };
    })
  );

  return builder as any as BuilderOutput;
};

export default createBuilder(commandBuilder);

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
      findUpSync('tsconfig.json', { cwd: options.configDir }) ??
      browserOptions.tsConfig,
  };
}

function runInstance(options: StandaloneBuildOptions) {
  return from(
    withTelemetry(
      'build',
      {
        cliOptions: options,
        presetOptions: { ...options, corePresets: [], overridePresets: [] },
        printError: printErrorDetails,
      },
      () => buildStaticStandalone(options)
    )
  ).pipe(catchError((error: any) => throwError(errorSummary(error))));
}
