import { type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import type { Channel } from 'storybook/internal/channels';
import { executeNodeCommand, loadPreviewOrConfigFile } from 'storybook/internal/common';
import {
  type StoryIndexGenerator,
  internal_universalStatusStore,
  internal_universalTestProviderStore,
} from 'storybook/internal/core-server';
import type { EventInfo, Options, PreviewAnnotation, StoryIndex } from 'storybook/internal/types';

import type { BuilderOptions } from '@storybook/builder-vite';

import { normalize } from 'pathe';

import { importMetaResolve } from '../../../../core/src/shared/utils/module.ts';
import {
  STATUS_STORE_CHANNEL_EVENT_NAME,
  STORE_CHANNEL_EVENT_NAME,
  STORY_INDEX_CHANNEL_EVENT_NAME,
  TEST_PROVIDER_STORE_CHANNEL_EVENT_NAME,
} from '../constants.ts';
import { log } from '../logger.ts';
import { errorToErrorLike } from '../utils.ts';
import type { Store } from '../types.ts';

const MAX_START_TIME = 30000;

// This path is a bit confusing, but essentially `boot-test-runner` gets bundled into the preset bundle
// which is at the root. Then, from the root, we want to load `node/vitest.mjs`
const vitestModulePath = fileURLToPath(importMetaResolve('@storybook/addon-vitest/vitest'));

// Events that were triggered before Vitest was ready are queued up and resent once it's ready
const eventQueue: { type: string; args?: any[] }[] = [];

type UniversalStoreBridge = {
  eventName: string;
  subscribe: (listener: (event: any, eventInfo: EventInfo) => void) => () => void;
};

let child: null | ChildProcess;
let ready = false;
let unsubscribeBridges: Array<() => void> = [];
let processExitHandled = false;
const storesKillingOnFatalError = new WeakSet<Store>();
// A kill ends the current boot: its later timeout, rejection, or exit must not touch the next one.
let generation = 0;
let booting: { generation: number; promise: Promise<void> } | undefined;

const killChild = () => {
  for (const unsubscribe of unsubscribeBridges) {
    unsubscribe();
  }
  unsubscribeBridges = [];
  child?.kill();
  child = null;
  ready = false;
  eventQueue.length = 0;
  generation++;
};

const forwardUniversalStoreEvent =
  (storeEventName: string) => (event: any, eventInfo: EventInfo) => {
    // Until the child is ready, runTestRunner queues run events and sends them after the story index
    if (!ready && event.type === 'TRIGGER_RUN') {
      return;
    }
    child?.send({
      type: storeEventName,
      args: [{ event, eventInfo }],
      from: 'server',
    });
  };

const bootTestRunner = async ({
  channel,
  store,
  options,
  configLoader,
}: {
  channel: Channel;
  store: Store;
  options: Options;
  configLoader?: BuilderOptions['configLoader'];
}) => {
  const universalStoreBridges: UniversalStoreBridge[] = [
    {
      eventName: STORE_CHANNEL_EVENT_NAME,
      subscribe: (listener) => store.subscribe(listener),
    },
    {
      eventName: STATUS_STORE_CHANNEL_EVENT_NAME,
      subscribe: (listener) => internal_universalStatusStore.subscribe(listener),
    },
    {
      eventName: TEST_PROVIDER_STORE_CHANNEL_EVENT_NAME,
      subscribe: (listener) => internal_universalTestProviderStore.subscribe(listener),
    },
  ];
  const bridgedEventNames = new Set(universalStoreBridges.map((bridge) => bridge.eventName));

  let stderr: string[] = [];

  if (!storesKillingOnFatalError.has(store)) {
    storesKillingOnFatalError.add(store);
    store.subscribe('FATAL_ERROR', () => {
      killChild();
      closeOpenRun(store);
    });
  }
  if (!processExitHandled) {
    processExitHandled = true;
    const exit = (code = 0) => {
      killChild();
      process.exit(code);
    };
    process.on('exit', exit);
    process.on('SIGINT', () => exit(0));
    process.on('SIGTERM', () => exit(0));
  }

  const bootGeneration = generation;
  // eslint-disable-next-line local-rules/no-uncategorized-errors
  const crashAlreadyReported = new Error('The test runner process crashed');

  const startChildProcess = async () => {
    const storyIndexGenerator =
      await options.presets.apply<Promise<StoryIndexGenerator>>('storyIndexGenerator');
    const previewAnnotations = await getPreviewAnnotations(options);
    if (bootGeneration !== generation) {
      throw crashAlreadyReported;
    }

    await new Promise<void>((resolve, reject) => {
      child = executeNodeCommand({
        scriptPath: vitestModulePath,
        options: {
          env: {
            VITEST: 'true',
            TEST: 'true',
            VITEST_CHILD_PROCESS: 'true',
            NODE_ENV: process.env.NODE_ENV ?? 'test',
            STORYBOOK_CONFIG_DIR: normalize(options.configDir),
            STORYBOOK_CONFIG_LOADER: configLoader,
            STORYBOOK_PREVIEW_ANNOTATIONS: JSON.stringify(previewAnnotations),
          },
          extendEnv: true,
        },
      });
      sentStoryIndex = undefined;
      stderr = [];

      const spawnedChild = child;
      spawnedChild.on('exit', (code: number | null, signal: NodeJS.Signals | null) => {
        // A child the server already cleared was killed after a reported fatal error or on shutdown.
        if (child === spawnedChild) {
          store.send({
            type: 'FATAL_ERROR',
            payload: {
              message: 'The test runner process exited unexpectedly',
              error: { message: signal ? `Killed by ${signal}` : `Exited with code ${code}` },
            },
          });
        }
        reject(crashAlreadyReported);
      });

      child.stdout?.on('data', log);
      child.stderr?.on('data', (data) => {
        // Ignore deprecation warnings which appear in yellow ANSI color
        if (!data.toString().match(/^\u001B\[33m/)) {
          log(data);
          stderr.push(data.toString());
        }
      });

      unsubscribeBridges = universalStoreBridges.map((bridge) =>
        bridge.subscribe(forwardUniversalStoreEvent(bridge.eventName))
      );

      child.on('message', (event: any) => {
        if (child !== spawnedChild) {
          return;
        }
        if (event.type === 'ready') {
          refreshStoryIndex(storyIndexGenerator).then(() => {
            if (child !== spawnedChild) {
              return;
            }
            ready = true;
            sendStoryIndex();
            // Resend events that triggered (during) the boot sequence, now that Vitest is ready
            while (eventQueue.length) {
              const { type, args } = eventQueue.shift()!;
              child?.send({ type, args, from: 'server' });
            }
            resolve();
          }, reject);
        } else if (event.type === 'uncaught-error') {
          store.send({
            type: 'FATAL_ERROR',
            payload: event.payload,
          });
          reject(crashAlreadyReported);
        } else if (bridgedEventNames.has(event.type)) {
          // Give the event to local store listeners only. emit() would also send it to browsers,
          // and the store leader already forwards that copy once.
          channel.receive(event);
        } else {
          channel.emit(event.type, ...event.args);
        }
      });
    });
  };

  const timeout = new Promise((_, reject) =>
    setTimeout(
      reject,
      MAX_START_TIME,
      // eslint-disable-next-line local-rules/no-uncategorized-errors
      new Error(
        `Aborting test runner process because it took longer than ${MAX_START_TIME / 1000} seconds to start.`
      )
    )
  );

  await Promise.race([startChildProcess(), timeout]).catch((error) => {
    if (bootGeneration !== generation) {
      throw error;
    }
    store.send({
      type: 'FATAL_ERROR',
      payload: {
        message: 'Failed to start test runner process',
        error: error instanceof Error ? errorToErrorLike(error) : { message: String(error) },
      },
    });
    throw error;
  });
};

export const runTestRunner = async ({
  channel,
  store,
  initEvent,
  initArgs,
  options,
  configLoader,
}: {
  channel: Channel;
  store: Store;
  initEvent?: string;
  initArgs?: any[];
  options: Options;
  configLoader?: BuilderOptions['configLoader'];
}) => {
  if (!ready && initEvent) {
    eventQueue.push({ type: initEvent, args: initArgs });
  }
  if (!child && booting?.generation !== generation) {
    const boot = {
      generation,
      promise: bootTestRunner({ channel, store, options, configLoader }),
    };
    booting = boot;
    boot.promise
      .catch(() => {})
      .then(() => {
        if (booting === boot) {
          booting = undefined;
        }
      });
  }
  await booting?.promise;
};

export const killTestRunner = () => {
  killChild();
  lastStoryIndex = undefined;
  sentStoryIndex = undefined;
};

let lastStoryIndex: StoryIndex | undefined;
let sentStoryIndex: StoryIndex | undefined;
let storyIndexRequests = 0;
let appliedStoryIndexRequest = 0;

// getIndex() throws while a story file is broken, so the runner keeps the last good index until
// the file is fixed. Concurrent getIndex() calls can resolve out of order; the newest call wins.
const refreshStoryIndex = async (storyIndexGenerator: StoryIndexGenerator) => {
  const request = ++storyIndexRequests;
  try {
    const index = await storyIndexGenerator.getIndex();
    if (request > appliedStoryIndexRequest) {
      appliedStoryIndexRequest = request;
      lastStoryIndex = index;
    }
  } catch (error) {
    if (!lastStoryIndex) {
      throw error;
    }
  }
};

const sendStoryIndex = () => {
  if (child && lastStoryIndex !== sentStoryIndex) {
    sentStoryIndex = lastStoryIndex;
    child.send({ type: STORY_INDEX_CHANNEL_EVENT_NAME, args: [lastStoryIndex], from: 'server' });
  }
};

// A child that is not ready yet gets the index from its ready handler.
export const sendStoryIndexToTestRunner = async (storyIndexGenerator: StoryIndexGenerator) => {
  await refreshStoryIndex(storyIndexGenerator);
  if (ready) {
    sendStoryIndex();
  }
};

const getPreviewAnnotations = async (options: Options): Promise<PreviewAnnotation[]> => {
  const previewAnnotations = await options.presets.apply<PreviewAnnotation[]>(
    'previewAnnotations',
    [],
    options
  );
  const previewPath = loadPreviewOrConfigFile({ configDir: options.configDir });
  return (previewAnnotations ?? []).concat(previewPath ?? []);
};

const closeOpenRun = (store: Store) =>
  store.setState((s) => ({
    ...s,
    cancelling: false,
    currentRun: {
      ...s.currentRun,
      finishedAt:
        s.currentRun.startedAt && !s.currentRun.finishedAt ? Date.now() : s.currentRun.finishedAt,
    },
  }));
