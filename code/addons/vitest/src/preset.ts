import { mkdir } from 'node:fs/promises';

import type { Channel } from 'storybook/internal/channels';
import { getFrameworkName, resolvePathInStorybookCache } from 'storybook/internal/common';
import { type StoryIndexGenerator, registerToolset } from 'storybook/internal/core-server';
import { logger } from 'storybook/internal/node-logger';
import { cleanPaths, oneWayHash, sanitizeError, telemetry } from 'storybook/internal/telemetry';
import type { Options, PresetPropertyFn, StoryId } from 'storybook/internal/types';

import type { BuilderOptions } from '@storybook/builder-vite';

import picocolors from 'picocolors';
import { dedent } from 'ts-dedent';

import {
  COVERAGE_DIRECTORY,
  STORE_CHANNEL_EVENT_NAME,
  STORYBOOK_ADDON_TEST_CHANNEL,
} from './constants.ts';
import { log } from './logger.ts';
import { runTestRunner } from './node/boot-test-runner.ts';
import {
  ensureTestRunnerStore,
  resolvePreviewBuilderName,
  wireTestRunResponder,
} from './node/test-run-responder.ts';
import { createTestToolset } from './node/toolset/definition.ts';
import type { StoreState } from './types.ts';

/**
 * Preset marker: true exactly when this addon is enabled, since only enabled addons' presets load.
 * addon-mcp's availability gate reads it through `presets.apply('isAddonVitestEnabled', false)`.
 */
export const isAddonVitestEnabled = true;

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

/**
 * Registers the public `test` toolset and wires the responder that answers its requests.
 *
 * This addon owns the toolset because running stories needs its channel protocol, but it must
 * register from the `services` hook rather than `experimental_serverChannel`: consumers resolve
 * the toolset for its descriptions and schemas alone, and the two places that do so — `storybook
 * ai` metadata generation (which never starts a dev server) and a non-Vite dev server (where the
 * channel hook returns early) — would otherwise ask for a toolset that was never registered and
 * fail hard. Registering here matches the availability gate that decides whether the tool is
 * offered at all: that gate reads the `isAddonVitestEnabled` marker this preset exports, which is
 * true exactly when the addon is enabled — the same condition under which this hook runs.
 *
 * The responder is wired here too — adjacent to the registration, behind the same gate — so every
 * consumer that can offer the tool can also answer it, dev server or not: this is what lets
 * `storybook tools test run` work without a running Storybook. The listener is cheap; the runner
 * machinery boots on first request.
 */
export const services = async (_value: void, options: Options): Promise<void> => {
  const getIndex = () =>
    options.presets
      .apply<StoryIndexGenerator>('storyIndexGenerator')
      .then((generator) => generator.getIndex());

  registerToolset(
    createTestToolset({
      channel: options.channel as Channel,
      storyIndex: { getIndex },
      a11yEnabled: await options.presets.apply('isAddonA11yEnabled', false),
    })
  );

  await wireTestRunResponder({ channel: options.channel as Channel | undefined, options });
};

export const experimental_serverChannel = async (channel: Channel, options: Options) => {
  const core = await options.presets.apply('core');

  const resolvedPreviewBuilder = resolvePreviewBuilderName(core);
  const framework = await getFrameworkName(options);

  // Only boot the test runner if the builder is vite, else just provide interactions functionality
  if (!resolvedPreviewBuilder?.includes('vite')) {
    if (framework.includes('nextjs')) {
      log(dedent`
        You're using ${framework}, which is a Webpack-based builder. In order to use Storybook's Vitest addon, with your project, you need to use '@storybook/nextjs-vite', a high performance Vite-based equivalent.

        Refer to the following documentation for more information: ${picocolors.yellow('https://storybook.js.org/docs/get-started/frameworks/nextjs-vite?ref=upgrade#choose-between-vite-and-webpack')}\n
      `);
    }
    return channel;
  }

  const configLoader =
    typeof core.builder !== 'string' &&
    (core.builder?.options?.configLoader as BuilderOptions['configLoader']);

  const storyIndexGenerator =
    await options.presets.apply<Promise<StoryIndexGenerator>>('storyIndexGenerator');

  // The request listener answering test-run requests is wired by the `services` hook; the runner
  // machinery it sets up lazily is run eagerly here because the manager UI needs the store
  // immediately. What follows are the dev-server extras: index invalidation refresh, watch mode,
  // and addon telemetry.
  const store = await ensureTestRunnerStore({ channel, options });

  storyIndexGenerator.onInvalidated(async () => {
    try {
      const index = await storyIndexGenerator.getIndex();
      store.setState((s) => ({ ...s, index }));
    } catch (error) {
      logger.debug('Failed to update story index after invalidation, Error:');
      logger.debug(error);
    }
  });

  store.subscribe('TOGGLE_WATCHING', (event, eventInfo) => {
    store.setState((s) => ({
      ...s,
      watching: event.payload.to,
      currentRun: {
        ...s.currentRun,
        // when enabling watch mode, clear the coverage summary too
        ...(event.payload.to && {
          coverageSummary: undefined,
        }),
      },
    }));
    if (event.payload.to) {
      runTestRunner({
        channel,
        store,
        initEvent: STORE_CHANNEL_EVENT_NAME,
        initArgs: [{ event, eventInfo }],
        options,
        configLoader: configLoader || undefined,
      });
    }
  });
  const enableCrashReports = core?.enableCrashReports || options.enableCrashReports;

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

  return channel;
};

export const staticDirs: PresetPropertyFn<'staticDirs'> = async (values = [], options) => {
  if (options.configType === 'PRODUCTION') {
    return values;
  }

  const coverageDirectory = resolvePathInStorybookCache(COVERAGE_DIRECTORY);
  await mkdir(coverageDirectory, { recursive: true });
  return [
    {
      from: coverageDirectory,
      to: '/coverage',
    },
    ...values,
  ];
};
