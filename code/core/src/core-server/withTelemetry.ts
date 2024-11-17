import { cache, loadAllPresets } from '@storybook/core/common';
import { getPrecedingUpgrade, oneWayHash, telemetry } from '@storybook/core/telemetry';
import type { EventType } from '@storybook/core/telemetry';
import type { CLIOptions } from '@storybook/core/types';

import { logger } from '@storybook/core/node-logger';

import prompts from 'prompts';

type TelemetryOptions = {
  cliOptions: CLIOptions;
  presetOptions?: Parameters<typeof loadAllPresets>[0];
  printError?: (err: any) => void;
  skipPrompt?: boolean;
};

const promptCrashReports = async () => {
  if (process.env.CI) {
    return undefined;
  }

  const { enableCrashReports } = await prompts({
    type: 'confirm',
    name: 'enableCrashReports',
    message: `Would you like to help improve Storybook by sending anonymous crash reports?`,
    initial: true,
  });

  await cache.set('enableCrashReports', enableCrashReports);

  return enableCrashReports;
};

type ErrorLevel = 'none' | 'error' | 'full';

export async function getErrorLevel({
  cliOptions,
  presetOptions,
  skipPrompt,
}: TelemetryOptions): Promise<ErrorLevel> {
  if (cliOptions.disableTelemetry) {
    return 'none';
  }

  // If we are running init or similar, we just have to go with true here
  if (!presetOptions) {
    return 'full';
  }

  // should we load the preset?
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
  options: TelemetryOptions
) {
  try {
    let errorLevel = 'error';
    try {
      errorLevel = await getErrorLevel(options);
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
          precedingUpgrade,
          error: errorLevel === 'full' ? error : undefined,
          errorHash,
          // if we ever end up sending a non-error instance, we'd like to know
          isErrorInstance: error instanceof Error,
        },
        {
          immediate: true,
          configDir: options.cliOptions.configDir || options.presetOptions?.configDir,
          enableCrashReports: errorLevel === 'full',
        }
      );
    }
  } catch (err) {
    // if this throws an error, we just move on
  }
}

export async function withTelemetry<T>(
  eventType: EventType,
  options: TelemetryOptions,
  run: () => Promise<T>
): Promise<T | undefined> {
  const enableTelemetry = !(
    options.cliOptions.disableTelemetry === true ||
    options.cliOptions.test === true ||
    options.cliOptions.versionUpdates === false
  );

  let canceled = false;

  async function cancelTelemetry() {
    canceled = true;
    if (enableTelemetry) {
      await telemetry('canceled', { eventType }, { stripMetadata: true, immediate: true });
    }

    process.exit(0);
  }

  if (eventType === 'init') {
    // We catch Ctrl+C user interactions to be able to detect a cancel event
    process.on('SIGINT', cancelTelemetry);
  }

  if (enableTelemetry) {
    telemetry('boot', { eventType }, { stripMetadata: true });
  }

  try {
    return await run();
  } catch (error: any) {
    if (canceled) {
      return undefined;
    }

    const { printError = logger.error } = options;
    printError(error);

    if (enableTelemetry) {
      await sendTelemetryError(error, eventType, options);
    }

    throw error;
  } finally {
    process.off('SIGINIT', cancelTelemetry);
  }
}
