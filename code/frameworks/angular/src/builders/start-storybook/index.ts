import { readFileSync } from 'node:fs';

import { getEnvConfig, getProjectRoot, versions } from '@storybook/core/internal/common';
import {
  buildDevStandalone,
  exitOnDevServerSignal,
  withTelemetry,
} from 'storybook/internal/server';
import { addToGlobalContext } from '@storybook/core/internal/telemetry';
import type { CLIOptions } from '@storybook/core/internal/types';
import { logger, logTracker } from '@storybook/core/internal/node-logger';

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
import { Observable } from 'rxjs';
import * as find from 'empathic/find';
import * as pkg from 'empathic/package';

import { errorSummary, printErrorDetails } from '../utils/error-handler.ts';
import { runCompodoc } from '../utils/run-compodoc.ts';
import type { StandaloneOptions } from '../utils/standalone-options.ts';
import { Channel } from '@storybook/core/internal/channels';

addToGlobalContext('cliVersion', versions.storybook);

export type StorybookBuilderOptions = JsonObject & {
  browserTarget?: string | null;
  tsConfig?: string;
  configDir: string;
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
    | 'logfile'
    | 'webpackStatsJson'
    | 'statsJson'
    | 'loglevel'
  >;

export type StorybookBuilderOutput = JsonObject & BuilderOutput & {};

type DevServer = Awaited<ReturnType<typeof buildDevStandalone>>;

const SMOKE_TEST_EXIT_GRACE_MS = 3000;

const commandBuilder: BuilderHandlerFn<StorybookBuilderOptions> = (
  options,
  context
): Observable<BuilderOutput> => {
  return new Observable<BuilderOutput>((observer) => {
    let server: DevServer | undefined;
    let removeSignalListeners: (() => void) | undefined;
    let tornDown = false;

    (async () => {
      try {
        // Apply logger configuration from builder options
        if (options.loglevel) {
          logger.setLogLevel(options.loglevel);
        }
        if (options.logfile) {
          logTracker.enableLogWriting();
        }

        logger.intro('Starting Storybook');

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
          sourceMap = false,
          preserveSymlinks = false,
          // Angular 21+ always supports zoneless; users still opt out via `experimentalZoneless: false`
          experimentalZoneless = true,
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
        };

        const result = await runInstance(standaloneOptions);
        if (tornDown) {
          await result.close();
          return;
        }

        if (result.exitCode !== undefined) {
          await result.close();
          observer.next({ success: result.exitCode === 0, info: { port: result.port } });
          observer.complete();
          // The Angular CLI never calls process.exit, so a lingering handle would hang the smoke test.
          setTimeout(() => process.exit(result.exitCode), SMOKE_TEST_EXIT_GRACE_MS).unref();
          return;
        }

        server = result;
        removeSignalListeners = exitOnDevServerSignal(result);
        // Never complete in dev mode: Architect keeps the builder, and so the server, running.
        observer.next({ success: true, info: { port: result.port } });
      } catch (error) {
        // Write logs to file on failure when enabled
        try {
          if (logTracker.shouldWriteLogsToFile) {
            try {
              const logFile = await logTracker.writeToFile(options.logfile as any);
              logger.outro(`Debug logs are written to: ${logFile}`);
            } catch {}
          }
        } catch {}
        observer.error(error);
      }
    })();

    return () => {
      tornDown = true;
      removeSignalListeners?.();
      server
        ?.close()
        .catch((error: unknown) => logger.debug(`Failed to close Storybook: ${error}`));
    };
  });
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

  const tsConfig =
    options.tsConfig ??
    find.up('tsconfig.json', { cwd: options.configDir }) ??
    browserOptions?.tsConfig;
  if (tsConfig === undefined) {
    throw new Error(
      'Storybook could not find a tsconfig.json. Set the "tsConfig" or "browserTarget" option of the Storybook builder.'
    );
  }

  return { tsConfig };
}
async function runInstance(options: StandaloneOptions): Promise<DevServer> {
  try {
    const result = await withTelemetry(
      'dev',
      {
        cliOptions: options,
        presetOptions: {
          ...options,
          corePresets: [],
          overridePresets: [],
          channel: new Channel({}),
        },
        printError: printErrorDetails,
      },
      () => {
        return buildDevStandalone(options);
      }
    );
    if (!result) {
      throw new Error('Storybook dev server did not start');
    }
    return result;
  } catch (error) {
    const summarized = errorSummary(error);
    throw new Error(String(summarized));
  }
}
