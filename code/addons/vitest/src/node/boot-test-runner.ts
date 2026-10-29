import { type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { bindToInstance } from '@storybook/core';
import type { Channel } from '@storybook/core/internal/channels';
import {
  executeNodeCommand,
  importMetaResolve,
  loadPreviewOrConfigFile,
} from '@storybook/core/internal/common';
import { type StoryIndexGenerator } from '@storybook/core/internal/story-index';
import { internal_UniversalStore } from '@storybook/core/internal/services';
import type { PreviewAnnotation, StoryIndex } from '@storybook/core/internal/types';

import type { BuilderOptions } from '@storybook/builder-vite';

import { normalize } from 'pathe';

import {
  STATUS_STORE_CHANNEL_EVENT_NAME,
  STORE_CHANNEL_EVENT_NAME,
  STORY_INDEX_CHANNEL_EVENT_NAME,
  TEST_PROVIDER_STORE_CHANNEL_EVENT_NAME,
} from '../constants.ts';
import { log } from '../logger.ts';
import { errorToErrorLike } from '../utils.ts';
import type { Store } from '../types.ts';
import type { TestRunnerHost } from './host.ts';

/** What a run request needs to boot or reach the Vitest child. */
export type RunTestRunnerInput = {
  channel: Channel;
  store: Store;
  initEvent?: string;
  initArgs?: any[];
  storybook: TestRunnerHost;
  configLoader?: BuilderOptions['configLoader'];
};

/** One instance's Vitest child process and the story index it was sent. */
export interface TestRunner {
  /** Boot the child if needed; `initEvent` is queued until it is ready. */
  run(input: RunTestRunnerInput): Promise<void>;
  /** Refresh the index and send it to a ready child. */
  sendStoryIndex(storyIndexGenerator: StoryIndexGenerator): Promise<void>;
  /** Kill the child and forget the index; a later run boots a new child. */
  kill(): void;
}

const MAX_START_TIME = 30000;

/** The stores the child is a client of; the instance owns all three. */
const BRIDGED_STORE_EVENT_NAMES = [
  STORE_CHANNEL_EVENT_NAME,
  STATUS_STORE_CHANNEL_EVENT_NAME,
  TEST_PROVIDER_STORE_CHANNEL_EVENT_NAME,
];

// This path is a bit confusing, but essentially `boot-test-runner` gets bundled into the preset bundle
// which is at the root. Then, from the root, we want to load `node/vitest.mjs`
const vitestModulePath = fileURLToPath(importMetaResolve('@storybook/addon-vitest/vitest'));

/** Creates the test runner of one instance; its state is never shared with another instance. */
export function createTestRunner(): TestRunner {
  // Events that were triggered before Vitest was ready are queued up and resent once it's ready
  const eventQueue: { type: string; args?: any[] }[] = [];
  let child: null | ChildProcess = null;
  let ready = false;
  let unsubscribeBridges: Array<() => void> = [];
  let removeProcessExitHandlers: (() => void) | undefined;
  const storesKillingOnFatalError = new WeakSet<Store>();
  // A kill ends the current boot: its later timeout, rejection, or exit must not touch the next one.
  let generation = 0;
  let booting: { generation: number; promise: Promise<void> } | undefined;
  let lastStoryIndex: StoryIndex | undefined;
  let sentStoryIndex: StoryIndex | undefined;
  let storyIndexRequests = 0;
  let appliedStoryIndexRequest = 0;

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

  // The child must not outlive the process, whichever instance owns it.
  const handleProcessExit = () => {
    if (removeProcessExitHandlers) {
      return;
    }
    const exit = (code = 0) => {
      killChild();
      process.exit(code);
    };
    const onExit = (code: number) => exit(code);
    const onSignal = () => exit(0);
    process.on('exit', onExit);
    process.on('SIGINT', onSignal);
    process.on('SIGTERM', onSignal);
    removeProcessExitHandlers = () => {
      process.off('exit', onExit);
      process.off('SIGINT', onSignal);
      process.off('SIGTERM', onSignal);
      removeProcessExitHandlers = undefined;
    };
  };

  const forwardOwnerMessage = (storeEventName: string) => (message: unknown) => {
    if (!internal_UniversalStore.isOwnerMessage(message)) {
      return;
    }
    // Until the child is ready, run() queues run events and sends them after the story index
    if (!ready && message.kind === 'event' && message.event.type === 'TRIGGER_RUN') {
      return;
    }
    child?.send({ type: storeEventName, args: [message], from: 'server' });
  };

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

  const sendLastStoryIndex = () => {
    if (child && lastStoryIndex !== sentStoryIndex) {
      sentStoryIndex = lastStoryIndex;
      child.send({ type: STORY_INDEX_CHANNEL_EVENT_NAME, args: [lastStoryIndex], from: 'server' });
    }
  };

  const bootTestRunner = async ({
    channel,
    store,
    storybook,
    configLoader,
  }: Omit<RunTestRunnerInput, 'initEvent' | 'initArgs'>) => {
    const bridgedEventNames = new Set(BRIDGED_STORE_EVENT_NAMES);

    let stderr: string[] = [];

    if (!storesKillingOnFatalError.has(store)) {
      storesKillingOnFatalError.add(store);
      store.subscribe('FATAL_ERROR', () => {
        const childWasReady = ready;
        killChild();
        closeOpenRun(store);
        // The file watcher lived in the dead child. A child that never got ready is not restarted,
        // so a broken Vitest setup does not boot in a loop.
        if (childWasReady && store.getState().watching) {
          run({ channel, store, storybook, configLoader }).then(
            () => store.setState((s) => ({ ...s, fatalError: undefined })),
            () => {}
          );
        }
      });
    }
    handleProcessExit();

    const bootGeneration = generation;
    // eslint-disable-next-line local-rules/no-uncategorized-errors
    const crashAlreadyReported = new Error('The test runner process crashed');

    const startChildProcess = async () => {
      const storyIndexGenerator = await storybook.getStoryIndexGenerator();
      const previewAnnotations = await getPreviewAnnotations(storybook);
      if (bootGeneration !== generation) {
        throw crashAlreadyReported;
      }

      await new Promise<void>((resolve, reject) => {
        child = executeNodeCommand({
          scriptPath: vitestModulePath,
          options: {
            // Story import paths are relative to the instance, not to the host process.
            cwd: storybook.workingDir,
            env: {
              VITEST: 'true',
              TEST: 'true',
              VITEST_CHILD_PROCESS: 'true',
              NODE_ENV: process.env.NODE_ENV ?? 'test',
              STORYBOOK_CONFIG_DIR: normalize(storybook.configDir),
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
          // A child the server already cleared was killed after a reported fatal error or on
          // shutdown.
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

        unsubscribeBridges = BRIDGED_STORE_EVENT_NAMES.map((eventName) => {
          const listener = forwardOwnerMessage(eventName);
          channel.on(eventName, listener);
          return () => channel.off(eventName, listener);
        });

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
              sendLastStoryIndex();
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
            // The child's store writes go to the owner only; the owner broadcasts the result.
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

  // Store events can arrive outside the instance's async context; the status store proxies need it.
  const run = bindToInstance(
    async ({
      channel,
      store,
      initEvent,
      initArgs,
      storybook,
      configLoader,
    }: RunTestRunnerInput): Promise<void> => {
      if (!ready && initEvent) {
        eventQueue.push({ type: initEvent, args: initArgs });
      }
      if (!child && booting?.generation !== generation) {
        const boot = {
          generation,
          promise: bootTestRunner({ channel, store, storybook, configLoader }),
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
    }
  );

  return {
    run,
    // A child that is not ready yet gets the index from its ready handler.
    async sendStoryIndex(storyIndexGenerator) {
      await refreshStoryIndex(storyIndexGenerator);
      if (ready) {
        sendLastStoryIndex();
      }
    },
    kill() {
      killChild();
      removeProcessExitHandlers?.();
      lastStoryIndex = undefined;
      sentStoryIndex = undefined;
    },
  };
}

const getPreviewAnnotations = async (storybook: TestRunnerHost): Promise<PreviewAnnotation[]> => {
  const previewAnnotations = await storybook.callHook('preview:annotations:collect', []);
  const previewPath = loadPreviewOrConfigFile({ configDir: storybook.configDir });
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
