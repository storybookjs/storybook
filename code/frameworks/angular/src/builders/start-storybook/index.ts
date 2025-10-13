import { readFileSync } from 'node:fs';

import { getEnvConfig, getProjectRoot, versions } from 'storybook/internal/common';
import { buildDevStandalone, withTelemetry } from 'storybook/internal/core-server';
import { addToGlobalContext } from 'storybook/internal/telemetry';
import type { CLIOptions } from 'storybook/internal/types';

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
import { Observable, from, of } from 'rxjs';
import { map, mapTo, switchMap } from 'rxjs/operators';

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

const commandBuilder: BuilderHandlerFn<StorybookBuilderOptions> = (options, context) => {
  const builder = from(setup(options, context)).pipe(
    switchMap(({ tsConfig }) => {
      const docTSConfig = find.up('tsconfig.doc.json', {
        cwd: options.configDir,
        last: getProjectRoot(),
      });

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

      return standaloneOptions;
    }),
    switchMap((standaloneOptions) => runInstance(standaloneOptions)),
    map((port: number) => {
      return { success: true, info: { port } };
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
      find.up('tsconfig.json', { cwd: options.configDir }) ??
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
