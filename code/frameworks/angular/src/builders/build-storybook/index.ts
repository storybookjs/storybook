import { readFileSync } from 'node:fs';

import { getEnvConfig, getProjectRoot, versions } from 'storybook/internal/common';
import { buildStaticStandalone, withTelemetry } from 'storybook/internal/core-server';
import { addToGlobalContext } from 'storybook/internal/telemetry';
import type { CLIOptions } from 'storybook/internal/types';
import { logger } from 'storybook/internal/node-logger';

import type {
  BuilderContext,
  BuilderHandlerFn,
  BuilderOutput,
  BuilderOutputLike,
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
import { from, of, throwError } from 'rxjs';
import { catchError, map, mapTo, switchMap } from 'rxjs/operators';

import { errorSummary, printErrorDetails } from '../utils/error-handler';
import { runCompodoc } from '../utils/run-compodoc';
import type { StandaloneOptions } from '../utils/standalone-options';
import { VERSION } from '@angular/core';

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
  experimentalZoneless?: boolean;
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
      const docTSConfig = find.up('tsconfig.doc.json', {
        cwd: options.configDir,
        last: getProjectRoot(),
      });
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
        experimentalZoneless = !!(VERSION.major && Number(VERSION.major) >= 21),
      } = options;

      const packageJsonPath = pkg.up({ cwd: __dirname });
      const packageJson =
        packageJsonPath != null ? JSON.parse(readFileSync(packageJsonPath, 'utf8')) : null;

      const standaloneOptions: StandaloneBuildOptions = {
        packageJson,
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
          experimentalZoneless,
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
      find.up('tsconfig.json', { cwd: options.configDir, last: getProjectRoot() }) ??
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
      async () => {
        logger.intro('Building storybook');
        const result = await buildStaticStandalone(options);
        logger.outro('Storybook build completed successfully');
        return result;
      }
    )
  ).pipe(catchError((error: any) => throwError(errorSummary(error))));
}
