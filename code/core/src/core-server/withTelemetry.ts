import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import {
  HandledError,
  cache,
  findConfigFile,
  isCI,
  loadAllPresets,
} from 'storybook/internal/common';
import { logger, prompt } from 'storybook/internal/node-logger';
import {
  ErrorCollector,
  SESSION_TIMEOUT,
  getAiSetupPending,
  getLastEvents,
  getPrecedingUpgrade,
  oneWayHash,
  telemetry,
} from 'storybook/internal/telemetry';
import type { EventType } from 'storybook/internal/telemetry';
import type { CLIOptions } from 'storybook/internal/types';

import { StorybookError } from '../storybook-error.ts';
import { detectAgent } from '../telemetry/detect-agent.ts';

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
  return !(options.cliOptions.disableTelemetry || options.cliOptions.test === true);
}

/**
 * Check whether the preview file has changed from an ai-setup baseline.
 * Inlined here to avoid cross-package imports from cli-storybook.
 */
async function checkPreviewChanged(
  configDir: string,
  baselineFile: string | null,
  baselineHash: string | null
): Promise<boolean> {
  const currentPath = findConfigFile('preview', configDir);
  if (currentPath !== baselineFile) {
    return true;
  }
  if (!currentPath) {
    return false;
  }
  try {
    const content = await readFile(currentPath, 'utf-8');
    const hash = createHash('sha256').update(content).digest('hex');
    return hash !== baselineHash;
  } catch {
    return baselineHash !== null;
  }
}

/**
 * Check for a pending ai-setup record and fire an evidence event if found.
 * Called from withTelemetry after the boot event for every CLI command.
 * Gated on: agent detected → pending record exists → within session window.
 */
async function collectAiSetupEvidence(
  eventType: EventType,
  options: TelemetryOptions
): Promise<void> {
  try {
    // Gate 1: Is this an agent? (cheapest check)
    const agent = detectAgent();
    if (!agent) {
      return;
    }

    // Gate 2: Is there a pending ai-setup record?
    const pending = await getAiSetupPending();
    if (!pending) {
      return;
    }

    // Gate 3: Is it within the session window?
    const msSinceAiPrepare = Date.now() - pending.timestamp;
    if (msSinceAiPrepare > SESSION_TIMEOUT) {
      return;
    }

    // Don't fire evidence for ai-prepare itself, it's too early.
    // The prepare command gives the prompt to the agent and exits,
    // so we only expect changes after the agent has started processing it.
    if (eventType === 'ai-prepare') {
      return;
    }

    // Check if preview file changed from baseline
    const previewChanged = await checkPreviewChanged(
      pending.configDir,
      pending.previewFile,
      pending.previewHash
    );

    // Check if doctor ran since ai-prepare
    const lastEvents = await getLastEvents();
    const doctorBoot = lastEvents.doctor;
    const doctorRanSinceSetup = Boolean(doctorBoot && doctorBoot.timestamp > pending.timestamp);

    await telemetry(
      'ai-setup-evidence',
      {
        trigger: eventType,
        msSinceAiPrepare,
        evidence: {
          previewChanged,
          aiAuthoredStories: 0,
          doctorRanSinceSetup,
        },
        traits: pending.traits,
      },
      {
        immediate: true,
        configDir: options.cliOptions.configDir || options.presetOptions?.configDir,
      }
    );
  } catch {
    // Evidence collection is best-effort — never block the actual command
  }
}

export async function withTelemetry<T>(
  eventType: EventType,
  options: TelemetryOptions,
  run: () => Promise<T>
): Promise<T | undefined> {
  const enableTelemetry = isTelemetryEnabled(options);

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

  if (enableTelemetry) {
    // Fire-and-forget: don't await, don't block the command
    collectAiSetupEvidence(eventType, options).catch(() => {});
  }

  try {
    return await run();
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

    if (enableTelemetry) {
      await sendTelemetryError(error, eventType, options);
    }

    throw error;
  } finally {
    if (enableTelemetry) {
      const errors = ErrorCollector.getErrors();
      for (const error of errors) {
        await sendTelemetryError(error, eventType, options, false);
      }
      process.off('SIGINT', cancelTelemetry);
    }
  }
}
