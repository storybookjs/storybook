import { type ChildProcess } from 'node:child_process';

import type { Channel } from 'storybook/internal/channels';
import {
  TESTING_MODULE_CANCEL_TEST_RUN_REQUEST,
  TESTING_MODULE_CRASH_REPORT,
  type TestingModuleCrashReportPayload,
} from 'storybook/internal/core-events';

// eslint-disable-next-line depend/ban-dependencies
import { execaNode } from 'execa';
import { join } from 'pathe';

import {
  STATUS_STORE_CHANNEL_EVENT_NAME,
  STORE_CHANNEL_EVENT_NAME,
  type Store,
  TEST_PROVIDER_ID,
  TEST_PROVIDER_STORE_CHANNEL_EVENT_NAME,
} from '../constants';
import { log } from '../logger';

const MAX_START_TIME = 30000;

// This path is a bit confusing, but essentially `boot-test-runner` gets bundled into the preset bundle
// which is at the root. Then, from the root, we want to load `node/vitest.mjs`
const vitestModulePath = join(__dirname, 'node', 'vitest.mjs');

// Events that were triggered before Vitest was ready are queued up and resent once it's ready
const eventQueue: { type: string; args?: any[] }[] = [];

let child: null | ChildProcess;
let ready = false;

const bootTestRunner = async (channel: Channel, store: Store) => {
  let stderr: string[] = [];

  const killChild = () => {
    channel.off(TESTING_MODULE_CANCEL_TEST_RUN_REQUEST, forwardCancel);
    channel.off(STORE_CHANNEL_EVENT_NAME, forwardStore);
    channel.off(STATUS_STORE_CHANNEL_EVENT_NAME, forwardStatusStore);
    channel.off(TEST_PROVIDER_STORE_CHANNEL_EVENT_NAME, forwardTestProviderStore);
    child?.kill();
    child = null;
  };

  store.subscribe('FATAL_ERROR', killChild);

  const forwardCancel = (...args: any[]) =>
    child?.send({ args, from: 'server', type: TESTING_MODULE_CANCEL_TEST_RUN_REQUEST });
  const forwardStore = (...args: any) => {
    child?.send({ args, from: 'server', type: STORE_CHANNEL_EVENT_NAME });
  };
  const forwardStatusStore = (...args: any) => {
    child?.send({ args, from: 'server', type: STATUS_STORE_CHANNEL_EVENT_NAME });
  };
  const forwardTestProviderStore = (...args: any) => {
    child?.send({ args, from: 'server', type: TEST_PROVIDER_STORE_CHANNEL_EVENT_NAME });
  };

  const exit = (code = 0) => {
    killChild();
    eventQueue.length = 0;
    process.exit(code);
  };

  process.on('exit', exit);
  process.on('SIGINT', () => exit(0));
  process.on('SIGTERM', () => exit(0));

  const startChildProcess = () =>
    new Promise<void>((resolve) => {
      child = execaNode(vitestModulePath, {
        env: { VITEST: 'true', TEST: 'true', NODE_ENV: process.env.NODE_ENV ?? 'test' },
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

      channel.on(STORE_CHANNEL_EVENT_NAME, forwardStore);
      channel.on(STATUS_STORE_CHANNEL_EVENT_NAME, forwardStatusStore);
      channel.on(TEST_PROVIDER_STORE_CHANNEL_EVENT_NAME, forwardTestProviderStore);

      child.on('message', (event: any) => {
        if (event.type === 'ready') {
          // Resend events that triggered (during) the boot sequence, now that Vitest is ready
          while (eventQueue.length) {
            const { type, args } = eventQueue.shift()!;
            child?.send({ type, args, from: 'server' });
          }

          // Forward all events from the channel to the child process
          channel.on(TESTING_MODULE_CANCEL_TEST_RUN_REQUEST, forwardCancel);

          resolve();
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

export const runTestRunner = async (
  channel: Channel,
  store: Store,
  initEvent?: string,
  initArgs?: any[]
) => {
  if (!ready && initEvent) {
    eventQueue.push({ type: initEvent, args: initArgs });
  }
  if (!child) {
    ready = false;
    await bootTestRunner(channel, store);
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
