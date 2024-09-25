import { getEnvConfig, versions } from 'storybook/internal/common';
import { buildDevStandalone, withTelemetry } from 'storybook/internal/core-server';
import { addToGlobalContext } from 'storybook/internal/telemetry';
import { CLIOptions } from 'storybook/internal/types';

import {
  BuilderContext,
  BuilderHandlerFn,
  BuilderOutput,
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
import { Observable, from, of } from 'rxjs';
import { map, mapTo, switchMap } from 'rxjs/operators';

import { errorSummary, printErrorDetails } from '../utils/error-handler';
import { runCompodoc } from '../utils/run-compodoc';
import { StandaloneOptions } from '../utils/standalone-options';

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

const commandBuilder: BuilderHandlerFn<StorybookBuilderOptions> = (options, context) => {
  const builder = from(setup(options, context)).pipe(
    switchMap(({ tsConfig }) => {
      const docTSConfig = findUpSync('tsconfig.doc.json', { cwd: options.configDir });

      const runCompodoc$ = options.compodoc
        ? runCompodoc(
            {
              compodocArgs: [...options.compodocArgs, ...(options.quiet ? ['--silent'] : [])],
              tsconfig: docTSConfig ?? tsConfig,
            },
            context
          ).pipe(mapTo({ tsConfig }))
        : of({});

      return runCompodoc$.pipe(mapTo({ tsConfig }));
    }),
    map(({ tsConfig }) => {
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
      } = options;

      const standaloneOptions: StandaloneOptions = {
        packageJson: findPackageSync(__dirname),
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

      return standaloneOptions;
    }),
    switchMap((standaloneOptions) => runInstance(standaloneOptions)),
    map((port: number) => {
      return { success: true, info: { port } };
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
function runInstance(options: StandaloneOptions) {
  return new Observable<number>((observer) => {
    // This Observable intentionally never complete, leaving the process running ;)
    withTelemetry(
      'dev',
      {
        cliOptions: options,
        presetOptions: { ...options, corePresets: [], overridePresets: [] },
        printError: printErrorDetails,
      },
      () => buildDevStandalone(options)
    )
      .then(({ port }) => observer.next(port))
      .catch((error) => {
        observer.error(errorSummary(error));
      });
  });
}
