/// <reference path="./typings.d.ts" />
import { TELEMETRY_ERROR } from 'storybook/internal/core-events';

import { globalPackages, globalsNameReferenceMap } from './globals/globals';
import { globalsNameValueMap } from './globals/runtime';
import { prepareForTelemetry, shouldSkipError } from './utils/prepareForTelemetry';

// Apply all the globals
globalPackages.forEach((key) => {
  globalThis[globalsNameReferenceMap[key]] = globalsNameValueMap[key];
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const errorQueue: any[] = [];

const flushErrorQueue = () => {
  const channel = globalThis.__STORYBOOK_ADDONS_CHANNEL__;
  if (channel) {
    errorQueue.forEach((error) => {
      channel.emit(TELEMETRY_ERROR, prepareForTelemetry(error));
    });
    errorQueue.length = 0;
    clearInterval(interval);
  }
};

const interval: NodeJS.Timeout = setInterval(flushErrorQueue, 1000);

globalThis.sendTelemetryError = (error: any) => {
  if (shouldSkipError(error)) {
    return;
  }

  const channel = globalThis.__STORYBOOK_ADDONS_CHANNEL__;

  if (channel) {
    channel.emit(TELEMETRY_ERROR, prepareForTelemetry(error));
  } else {
    // if the channel is not available, we queue the error to be sent later
    errorQueue.push(error);
  }
};

// handle all uncaught errors at the root of the application and log to telemetry
globalThis.addEventListener('error', (args) => {
  const error = args.error || args;
  globalThis.sendTelemetryError(error);
});

globalThis.addEventListener('unhandledrejection', ({ reason }) => {
  globalThis.sendTelemetryError(reason);
});
