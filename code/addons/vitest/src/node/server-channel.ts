import type { Channel } from '@storybook/core/internal/channels';
import { getFrameworkNameFromConfig } from '@storybook/core/internal/common';
import { logger } from '@storybook/core/internal/node-logger';
import { internal_UniversalStore } from '@storybook/core/internal/services';
import {
  cleanPaths,
  oneWayHash,
  sanitizeError,
  telemetry,
} from '@storybook/core/internal/telemetry';
import type { StoryId } from '@storybook/core/internal/types';

import type { BuilderOptions } from '@storybook/builder-vite';

import picocolors from 'picocolors';
import { dedent } from 'ts-dedent';

import { STORE_CHANNEL_EVENT_NAME, STORYBOOK_ADDON_TEST_CHANNEL } from '../constants.ts';
import { log } from '../logger.ts';
import type { StoreState } from '../types.ts';
import type { TestRunnerHost } from './host.ts';
import { resolvePreviewBuilderName, type TestRunnerRuntime } from './test-run-responder.ts';

type Event =
  | {
      type: 'test-discrepancy';
      payload: {
        storyId: StoryId;
        browserStatus: 'PASS' | 'FAIL';
        cliStatus: 'FAIL' | 'PASS';
        message: string;
      };
    }
  | {
      type: 'test-run-completed';
      payload: StoreState['currentRun'];
    };

/** Set up the dev server's test runner store, story index refresh, watch mode, and telemetry. */
export async function wireTestServerChannel(
  storybook: TestRunnerHost,
  channel: Channel,
  { enableCrashReports: enableCrashReportsOption }: { enableCrashReports?: boolean },
  runtime: TestRunnerRuntime
): Promise<void> {
  const core = await storybook.callHook('core:config:extend', undefined);

  const resolvedPreviewBuilder = resolvePreviewBuilderName(core);
  const framework =
    getFrameworkNameFromConfig(await storybook.callHook('core:framework:extend', '')) ?? '';

  // Only Vite builds can boot the runner; others keep the interactions features.
  if (!resolvedPreviewBuilder?.includes('vite')) {
    if (framework.includes('nextjs')) {
      log(dedent`
        You're using ${framework}, which is a Webpack-based builder. In order to use Storybook's Vitest addon, with your project, you need to use '@storybook/nextjs-vite', a high performance Vite-based equivalent.

        Refer to the following documentation for more information: ${picocolors.yellow('https://storybook.js.org/docs/get-started/frameworks/nextjs-vite?ref=upgrade#choose-between-vite-and-webpack')}\n
      `);
    }
    return;
  }

  const configLoader =
    typeof core.builder !== 'string' &&
    (core.builder?.options?.configLoader as BuilderOptions['configLoader']);

  // The services hook answers run requests lazily; the manager needs the store right away.
  const store = await runtime.ensureStore(channel);

  const storyIndexGenerator = await storybook.getStoryIndexGenerator();
  const refreshTestRunnerStoryIndex = () =>
    runtime.runner.sendStoryIndex(storyIndexGenerator).catch((error) => {
      logger.debug('Failed to send the story index to the test runner, Error:');
      logger.debug(error);
    });
  refreshTestRunnerStoryIndex();
  storyIndexGenerator.onInvalidated(refreshTestRunnerStoryIndex);

  store.subscribe('TOGGLE_WATCHING', (event, eventInfo) => {
    store.setState((s) => ({
      ...s,
      watching: event.payload.to,
      currentRun: {
        ...s.currentRun,
        // Enabling watch mode clears the coverage summary too.
        ...(event.payload.to && {
          coverageSummary: undefined,
        }),
      },
    }));
    if (event.payload.to) {
      runtime.runner.run({
        channel,
        store,
        initEvent: STORE_CHANNEL_EVENT_NAME,
        initArgs: [internal_UniversalStore.eventMessage(event, eventInfo)],
        storybook,
        configLoader: configLoader || undefined,
      });
    }
  });
  const enableCrashReports = core?.enableCrashReports || enableCrashReportsOption;

  channel.on(STORYBOOK_ADDON_TEST_CHANNEL, (event: Event) => {
    if (event.type !== 'test-run-completed') {
      telemetry('addon-test', () => ({
        ...event,
        payload: {
          ...event.payload,
          storyId: oneWayHash(event.payload.storyId),
        },
      }));
    }
  });

  store.subscribe('TOGGLE_WATCHING', async (event) => {
    await telemetry('addon-test', () => ({
      watchMode: event.payload.to,
    }));
  });
  store.subscribe('TEST_RUN_COMPLETED', async (event) => {
    const { unhandledErrors, startedAt, finishedAt, ...currentRun } = event.payload;
    await telemetry('addon-test', () => ({
      ...currentRun,
      duration: (finishedAt ?? 0) - (startedAt ?? 0),
      unhandledErrorCount: unhandledErrors.length,
      ...(enableCrashReports &&
        unhandledErrors.length > 0 && {
          unhandledErrors: unhandledErrors.map((error) => {
            const { stacks, ...errorWithoutStacks } = error;
            return sanitizeError(errorWithoutStacks);
          }),
        }),
    }));
  });

  if (enableCrashReports) {
    store.subscribe('FATAL_ERROR', async (event) => {
      await telemetry('addon-test', () => ({
        fatalError: cleanPaths(event.payload.error.message),
      }));
    });
  }
}
