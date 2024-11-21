import { type ChildProcess } from 'node:child_process';

import type { Channel } from 'storybook/internal/channels';
import {
  TESTING_MODULE_CANCEL_TEST_RUN_REQUEST,
  TESTING_MODULE_CRASH_REPORT,
  TESTING_MODULE_RUN_ALL_REQUEST,
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

let child: null | ChildProcess;
let ready = false;

const bootTestRunner = async (channel: Channel, initEvent?: string, initArgs?: any[]) => {
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
  const forwardRunAll = (...args: any[]) =>
    child?.send({ args, from: 'server', type: TESTING_MODULE_RUN_ALL_REQUEST });
  const forwardWatchMode = (...args: any[]) =>
    child?.send({ args, from: 'server', type: TESTING_MODULE_WATCH_MODE_REQUEST });
  const forwardCancel = (...args: any[]) =>
    child?.send({ args, from: 'server', type: TESTING_MODULE_CANCEL_TEST_RUN_REQUEST });

  const killChild = () => {
    channel.off(TESTING_MODULE_RUN_REQUEST, forwardRun);
    channel.off(TESTING_MODULE_RUN_ALL_REQUEST, forwardRunAll);
    channel.off(TESTING_MODULE_WATCH_MODE_REQUEST, forwardWatchMode);
    channel.off(TESTING_MODULE_CANCEL_TEST_RUN_REQUEST, forwardCancel);
    child?.kill();
    child = null;
  };

  const exit = (code = 0) => {
    killChild();
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
          // Resend the event that triggered the boot sequence, now that the child is ready to handle it
          if (initEvent && initArgs) {
            child?.send({ type: initEvent, args: initArgs, from: 'server' });
          }

          // Forward all events from the channel to the child process
          channel.on(TESTING_MODULE_RUN_REQUEST, forwardRun);
          channel.on(TESTING_MODULE_RUN_ALL_REQUEST, forwardRunAll);
          channel.on(TESTING_MODULE_WATCH_MODE_REQUEST, forwardWatchMode);
          channel.on(TESTING_MODULE_CANCEL_TEST_RUN_REQUEST, forwardCancel);

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
    throw e;
  });
};

export const runTestRunner = async (channel: Channel, initEvent?: string, initArgs?: any[]) => {
  if (!child) {
    ready = false;
    await bootTestRunner(channel, initEvent, initArgs);
    ready = true;
  }
};

export const killTestRunner = () => {
  if (child) {
    child.kill();
    child = null;
  }
};
