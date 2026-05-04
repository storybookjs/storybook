import {
  HandledError,
  cache,
  loadMainConfig,
  isCI,
  loadAllPresets,
} from 'storybook/internal/common';
import { logger, prompt } from 'storybook/internal/node-logger';
import {
  collectAiSetupEvidence,
  ErrorCollector,
  getPrecedingUpgrade,
  isTelemetryStateResolved,
  oneWayHash,
  onPayloadError,
  setTelemetryEnabled,
  telemetry,
} from 'storybook/internal/telemetry';
import type { EventType } from 'storybook/internal/telemetry';
import type { CLIOptions, StorybookConfigRaw } from 'storybook/internal/types';

import { StorybookError } from '../storybook-error.ts';

type TelemetryOptions = {
  cliOptions: CLIOptions;
  presetOptions?: Parameters<typeof loadAllPresets>[0];
  printError?: (err: any) => void;
  skipPrompt?: boolean;
  eventType?: EventType;
  fallbackTelemetryState?: boolean;
};

const promptCrashReports = async () => {
  if (isCI() || !process.stdout.isTTY) {
    return undefined;
  }

  const enableCrashReports = await prompt.confirm({
    message:
      'Would you like to send anonymous crash reports to improve Storybook and fix bugs faster?',
    initialValue: true,
  });

  await cache.set('enableCrashReports', enableCrashReports);

  return enableCrashReports;
};

type ErrorLevel = 'none' | 'error' | 'full';

export async function getErrorLevel({
  cliOptions,
  presetOptions,
  skipPrompt,
  eventType,
}: TelemetryOptions): Promise<ErrorLevel> {
  if (cliOptions.disableTelemetry) {
    return 'none';
  }

  if (!presetOptions && eventType !== 'init') {
    return 'error';
  }

  if (presetOptions) {
    const presets = await loadAllPresets(presetOptions);

    // If the user has chosen to enable/disable crash reports in main.js
    // or disabled telemetry, we can return that
    const core = await presets.apply('core');

    if (core?.enableCrashReports !== undefined) {
      return core.enableCrashReports ? 'full' : 'error';
    }

    if (core?.disableTelemetry) {
      return 'none';
    }
  }

  // Deal with typo, remove in future version (7.1?)
  const valueFromCache =
    (await cache.get('enableCrashReports')) ?? (await cache.get('enableCrashreports'));

  if (valueFromCache !== undefined) {
    return valueFromCache ? 'full' : 'error';
  }

  if (skipPrompt) {
    return 'error';
  }

  const valueFromPrompt = await promptCrashReports();

  if (valueFromPrompt !== undefined) {
    return valueFromPrompt ? 'full' : 'error';
  }

  return 'full';
}

export async function sendTelemetryError(
  _error: unknown,
  eventType: EventType,
  options: TelemetryOptions,
  blocking = true,
  parent?: StorybookError
) {
  try {
    let errorLevel = 'error';
    try {
      errorLevel = await getErrorLevel({
        ...options,
        eventType,
        skipPrompt: options.skipPrompt || (eventType === 'init' && !blocking),
      });
    } catch (err) {
      // If this throws, eg. due to main.js breaking, we fall back to 'error'
    }
    if (errorLevel !== 'none') {
      const precedingUpgrade = await getPrecedingUpgrade();

      const error = _error as Error & Record<string, any>;

      let errorHash;
      if ('message' in error) {
        errorHash = error.message ? oneWayHash(error.message) : 'EMPTY_MESSAGE';
      } else {
        errorHash = 'NO_MESSAGE';
      }

      const { code, name, category } = error;
      await telemetry(
        'error',
        {
          code,
          name,
          category,
          eventType,
          blocking,
          precedingUpgrade,
          error: errorLevel === 'full' ? error : undefined,
          errorHash,
          // if we ever end up sending a non-error instance, we'd like to know
          isErrorInstance: error instanceof Error,
          // Include parent error information if this is a sub-error
          ...(parent ? { parent: parent.fullErrorCode } : {}),
        },
        {
          immediate: true,
          configDir: options.cliOptions.configDir || options.presetOptions?.configDir,
          enableCrashReports: errorLevel === 'full',
          force: true,
        }
      );

      // If this is a StorybookError with sub-errors, send telemetry for each sub-error separately
      if (error && 'subErrors' in error && error.subErrors.length > 0) {
        for (const subError of error.subErrors) {
          await sendTelemetryError(subError, eventType, options, blocking, error as StorybookError);
        }
      }
    }
  } catch (err) {
    // if this throws an error, we just move on
  }
}

async function resolveTelemetryState(options: TelemetryOptions) {
  // 1. If telemetry is explicitly set via CLI options or env var, set and skip loading main config
  if (options.cliOptions.disableTelemetry !== undefined) {
    return await setTelemetryEnabled(!options.cliOptions.disableTelemetry);
  }

  let mainConfig;
  const configDir =
    options.cliOptions.configDir ?? options.presetOptions?.configDir ?? '.storybook';
  try {
    mainConfig = (await loadMainConfig({ configDir })) as StorybookConfigRaw;
  } catch {}

  // 2. If main config succesfully loaded, set based on that
  // (unset = enabled, true/false = disabled/enabled)
  if (mainConfig) {
    return await setTelemetryEnabled(!mainConfig?.core?.disableTelemetry);
  }

  // 3. If main config could not be loaded, set to fallback,
  // which is usually disabled but can be enabled for certain commands (e.g. init)
  await setTelemetryEnabled(options.fallbackTelemetryState ?? false);
}

export async function withTelemetry<T>(
  eventType: EventType,
  options: TelemetryOptions,
  run: () => Promise<T>
): Promise<T | undefined> {
  if (!isTelemetryStateResolved()) {
    await resolveTelemetryState(options);
  }

  let canceled = false;

  async function cancelTelemetry() {
    canceled = true;
    await telemetry('canceled', { eventType }, { stripMetadata: true, immediate: true });

    process.exit(0);
  }

  if (eventType === 'init') {
    // We catch Ctrl+C user interactions to be able to detect a cancel event
    process.on('SIGINT', cancelTelemetry);
  }

  // Register error handler so that payload factories returning { error } or throwing
  // automatically trigger sendTelemetryError with full context (presets, cache, error levels).
  onPayloadError(async (error, evtType) => {
    await sendTelemetryError(error, evtType, options);
  });

  telemetry('boot', { eventType }, { stripMetadata: true });

  // Fire-and-forget: don't await, don't block the command
  const configDir = options.cliOptions.configDir || options.presetOptions?.configDir;
  collectAiSetupEvidence(eventType, configDir);

  try {
    const result = await run();
    return result;
  } catch (error: any) {
    if (canceled) {
      return undefined;
    }

    const isHandledError =
      error instanceof HandledError || (error instanceof StorybookError && error.isHandledError);

    if (!isHandledError) {
      const { printError = logger.error } = options;
      printError(error);
    }

    await sendTelemetryError(error, eventType, options);

    throw error;
  } finally {
    const errors = ErrorCollector.getErrors();
    for (const error of errors) {
      await sendTelemetryError(error, eventType, options, false);
    }
    process.off('SIGINT', cancelTelemetry);
    onPayloadError(undefined);
  }
}
