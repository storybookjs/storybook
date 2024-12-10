import { type ChildProcess } from 'node:child_process';

import type { Channel } from 'storybook/internal/channels';
import {
  TESTING_MODULE_CANCEL_TEST_RUN_REQUEST,
  TESTING_MODULE_CONFIG_CHANGE,
  TESTING_MODULE_CRASH_REPORT,
  TESTING_MODULE_RUN_REQUEST,
  TESTING_MODULE_WATCH_MODE_REQUEST,
  type TestingModuleCrashReportPayload,
} from 'storybook/internal/core-events';

// eslint-disable-next-line depend/ban-dependencies
import { execaNode } from 'execa';
import { join } from 'pathe';

import { TEST_PROVIDER_ID } from '../constants';
import { log } from '../logger';

const MAX_START_TIME = 30000;

// This path is a bit confusing, but essentially `boot-test-runner` gets bundled into the preset bundle
// which is at the root. Then, from the root, we want to load `node/vitest.mjs`
const vitestModulePath = join(__dirname, 'node', 'vitest.mjs');

// Events that were triggered before Vitest was ready are queued up and resent once it's ready
const eventQueue: { type: string; args: any[] }[] = [];

let child: null | ChildProcess;
let ready = false;

const bootTestRunner = async (channel: Channel) => {
  let stderr: string[] = [];

  function reportFatalError(e: any) {
    channel.emit(TESTING_MODULE_CRASH_REPORT, {
      providerId: TEST_PROVIDER_ID,
      error: {
        message: String(e),
      },
    } as TestingModuleCrashReportPayload);
  }

  const forwardRun = (...args: any[]) =>
    child?.send({ args, from: 'server', type: TESTING_MODULE_RUN_REQUEST });
  const forwardWatchMode = (...args: any[]) =>
    child?.send({ args, from: 'server', type: TESTING_MODULE_WATCH_MODE_REQUEST });
  const forwardCancel = (...args: any[]) =>
    child?.send({ args, from: 'server', type: TESTING_MODULE_CANCEL_TEST_RUN_REQUEST });
  const forwardConfigChange = (...args: any[]) =>
    child?.send({ args, from: 'server', type: TESTING_MODULE_CONFIG_CHANGE });

  const killChild = () => {
    channel.off(TESTING_MODULE_RUN_REQUEST, forwardRun);
    channel.off(TESTING_MODULE_WATCH_MODE_REQUEST, forwardWatchMode);
    channel.off(TESTING_MODULE_CANCEL_TEST_RUN_REQUEST, forwardCancel);
    channel.off(TESTING_MODULE_CONFIG_CHANGE, forwardConfigChange);
    child?.kill();
    child = null;
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
    new Promise<void>((resolve, reject) => {
      child = execaNode(vitestModulePath);
      stderr = [];

      child.stdout?.on('data', log);
      child.stderr?.on('data', (data) => {
        // Ignore deprecation warnings which appear in yellow ANSI color
        if (!data.toString().match(/^\u001B\[33m/)) {
          log(data);
          stderr.push(data.toString());
        }
      });

      child.on('message', (result: any) => {
        if (result.type === 'ready') {
          // Resend events that triggered (during) the boot sequence, now that Vitest is ready
          while (eventQueue.length) {
            const { type, args } = eventQueue.shift();
            child?.send({ type, args, from: 'server' });
          }

          // Forward all events from the channel to the child process
          channel.on(TESTING_MODULE_RUN_REQUEST, forwardRun);
          channel.on(TESTING_MODULE_WATCH_MODE_REQUEST, forwardWatchMode);
          channel.on(TESTING_MODULE_CANCEL_TEST_RUN_REQUEST, forwardCancel);
          channel.on(TESTING_MODULE_CONFIG_CHANGE, forwardConfigChange);

          resolve();
        } else if (result.type === 'error') {
          killChild();
          log(result.message);
          log(result.error);
          // eslint-disable-next-line local-rules/no-uncategorized-errors
          const error = new Error(`${result.message}\n${result.error}`);
          // Reject if the child process reports an error before it's ready
          if (!ready) {
            reject(error);
          } else {
            reportFatalError(error);
          }
        } else {
          channel.emit(result.type, ...result.args);
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

  await Promise.race([startChildProcess(), timeout]).catch((e) => {
    reportFatalError(e);
    eventQueue.length = 0;
    throw e;
  });
};

export const runTestRunner = async (channel: Channel, initEvent?: string, initArgs?: any[]) => {
  if (!ready && initEvent) {
    eventQueue.push({ type: initEvent, args: initArgs });
  }
  if (!child) {
    ready = false;
    await bootTestRunner(channel);
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
