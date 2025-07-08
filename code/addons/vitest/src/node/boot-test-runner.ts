import { type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import type { Channel } from 'storybook/internal/channels';
import {
  internal_universalStatusStore,
  internal_universalTestProviderStore,
} from 'storybook/internal/core-server';
import type { EventInfo, Options } from 'storybook/internal/types';

// eslint-disable-next-line depend/ban-dependencies
import { execaNode } from 'execa';
import { normalize } from 'pathe';

import { importMetaResolve } from '../../../../core/src/shared/utils/module';
import {
  STATUS_STORE_CHANNEL_EVENT_NAME,
  STORE_CHANNEL_EVENT_NAME,
  TEST_PROVIDER_STORE_CHANNEL_EVENT_NAME,
} from '../constants';
import { log } from '../logger';
import type { Store } from '../types';

const MAX_START_TIME = 30000;

// This path is a bit confusing, but essentially `boot-test-runner` gets bundled into the preset bundle
// which is at the root. Then, from the root, we want to load `node/vitest.mjs`
const vitestModulePath = fileURLToPath(importMetaResolve('@storybook/addon-vitest/vitest'));

// Events that were triggered before Vitest was ready are queued up and resent once it's ready
const eventQueue: { type: string; args?: any[] }[] = [];

let child: null | ChildProcess;
let ready = false;
let unsubscribeStore: () => void;
let unsubscribeStatusStore: () => void;
let unsubscribeTestProviderStore: () => void;

const forwardUniversalStoreEvent =
  (storeEventName: string) => (event: any, eventInfo: EventInfo) => {
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
}: {
  channel: Channel;
  store: Store;
  options: Options;
}) => {
  let stderr: string[] = [];
  const killChild = () => {
    unsubscribeStore?.();
    unsubscribeStatusStore?.();
    unsubscribeTestProviderStore?.();
    child?.kill();
    child = null;
  };

  store.subscribe('FATAL_ERROR', killChild);

  const exit = (code = 0) => {
    killChild();
    eventQueue.length = 0;
    process.exit(code);
  };

  process.on('exit', exit);
  process.on('SIGINT', () => exit(0));
  process.on('SIGTERM', () => exit(0));

  const startChildProcess = () =>
    new Promise<void>((resolve, reject) => {
      child = execaNode(vitestModulePath, {
        env: {
          VITEST: 'true',
          TEST: 'true',
          VITEST_CHILD_PROCESS: 'true',
          NODE_ENV: process.env.NODE_ENV ?? 'test',
          STORYBOOK_CONFIG_DIR: normalize(options.configDir),
        },
        extendEnv: true,
      });
      stderr = [];

      child.stdout?.on('data', log);
      child.stderr?.on('data', (data) => {
        // Ignore deprecation warnings which appear in yellow ANSI color
        if (!data.toString().match(/^\u001B\[33m/)) {
          log(data);
          stderr.push(data.toString());
        }
      });

      unsubscribeStore = store.subscribe(forwardUniversalStoreEvent(STORE_CHANNEL_EVENT_NAME));
      unsubscribeStatusStore = internal_universalStatusStore.subscribe(
        forwardUniversalStoreEvent(STATUS_STORE_CHANNEL_EVENT_NAME)
      );
      unsubscribeTestProviderStore = internal_universalTestProviderStore.subscribe(
        forwardUniversalStoreEvent(TEST_PROVIDER_STORE_CHANNEL_EVENT_NAME)
      );

      child.on('message', (event: any) => {
        if (event.type === 'ready') {
          // Resend events that triggered (during) the boot sequence, now that Vitest is ready
          while (eventQueue.length) {
            const { type, args } = eventQueue.shift()!;
            child?.send({ type, args, from: 'server' });
          }
          resolve();
        } else if (event.type === 'uncaught-error') {
          store.send({
            type: 'FATAL_ERROR',
            payload: event.payload,
          });
          reject();
        } else {
          channel.emit(event.type, ...event.args);
        }
      });
    });

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
    store.send({
      type: 'FATAL_ERROR',
      payload: {
        message: 'Failed to start test runner process',
        error: {
          message: error.message,
          name: error.name,
          stack: error.stack,
          cause: error.cause,
        },
      },
    });
    eventQueue.length = 0;
    throw error;
  });
};

export const runTestRunner = async ({
  channel,
  store,
  initEvent,
  initArgs,
  options,
}: {
  channel: Channel;
  store: Store;
  initEvent?: string;
  initArgs?: any[];
  options: Options;
}) => {
  if (!ready && initEvent) {
    eventQueue.push({ type: initEvent, args: initArgs });
  }
  if (!child) {
    ready = false;
    await bootTestRunner({ channel, store, options });
    ready = true;
  }
};

export const killTestRunner = () => {
  if (child) {
    child.kill();
    child = null;
  }
  ready = false;
  eventQueue.length = 0;
};
