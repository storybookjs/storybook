import {
  HandledError,
  cache,
  getStorybookInfo,
  isCI,
  loadAllPresets,
} from 'storybook/internal/common';
import { logger, prompt } from 'storybook/internal/node-logger';
import {
  ErrorCollector,
  getPrecedingUpgrade,
  isTelemetryStateResolved,
  oneWayHash,
  onPayloadError,
  setTelemetryEnabled,
  telemetry,
} from 'storybook/internal/telemetry';
import type { EventType } from 'storybook/internal/telemetry';
import type { CLIOptions } from 'storybook/internal/types';

import { StorybookError } from '../storybook-error.ts';
import { dirname } from 'path';

type TelemetryOptions = {
  cliOptions: CLIOptions;
  presetOptions?: Parameters<typeof loadAllPresets>[0];
  printError?: (err: any) => void;
  skipPrompt?: boolean;
  eventType?: EventType;
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

export function isTelemetryEnabled(options: TelemetryOptions) {
  return !options.cliOptions.disableTelemetry;
}

/**
 * Resolve telemetry state by loading presets from configDir to check core.disableTelemetry.
 * Used when run() completes without resolving telemetry state (e.g. CLI commands like
 * add/remove/doctor/upgrade/migrate that don't load presets themselves).
 */
async function tryResolveTelemetryStateFromConfig(options: TelemetryOptions) {
  const configDir = options.cliOptions.configDir || options.presetOptions?.configDir;

  try {
    const { mainConfig } = await getStorybookInfo(
      configDir,
      configDir ? dirname(configDir) : undefined
    );

    if (!mainConfig) {
      // No config dir available — default to enabled
      await setTelemetryEnabled(true);
      return;
    }

    await setTelemetryEnabled(!mainConfig.core?.disableTelemetry);
  } catch {
    // If presets fail to load, conservatively disable
    await setTelemetryEnabled(false);
  }
}

export async function withTelemetry<T>(
  eventType: EventType,
  options: TelemetryOptions,
  run: () => Promise<T>
): Promise<T | undefined> {
  if (!isTelemetryEnabled(options)) {
    await setTelemetryEnabled(false);
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

  try {
    const result = await run();

    // If run() completed but telemetry state was never resolved (e.g. CLI commands like
    // add/remove/doctor that don't load presets themselves), load the config to resolve it.
    if (!isTelemetryStateResolved()) {
      await tryResolveTelemetryStateFromConfig(options);
    }

    return result;
  } catch (error: any) {
    if (!isTelemetryStateResolved()) {
      await tryResolveTelemetryStateFromConfig(options);
    }

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
