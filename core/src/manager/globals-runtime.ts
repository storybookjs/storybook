/// <reference path="./typings.d.ts" />
import { TELEMETRY_ERROR } from 'storybook/internal/core-events';

import { globalPackages, globalsNameReferenceMap } from './globals/globals';
import { globalsNameValueMap } from './globals/runtime';
import { prepareForTelemetry, shouldSkipError } from './utils/prepareForTelemetry';

// Apply all the globals
globalPackages.forEach((key) => {
  globalThis[globalsNameReferenceMap[key]] = globalsNameValueMap[key];
});

const queuedErrors: Error[] = [];

globalThis.sendTelemetryError = (error) => {
  if (shouldSkipError(error)) {
    return;
  }

  const channel = globalThis.__STORYBOOK_ADDONS_CHANNEL__;
  const preparedError = prepareForTelemetry(error);

  if (!channel) {
    queuedErrors.push(preparedError);
    return;
  }

  // Flush any queued errors first
  while (queuedErrors.length > 0) {
    const queuedError = queuedErrors.shift();
    channel.emit(TELEMETRY_ERROR, queuedError);
  }

  channel.emit(TELEMETRY_ERROR, preparedError);
};

// handle all uncaught errors at the root of the application and log to telemetry
globalThis.addEventListener('error', (args) => {
  const error = args.error || args;
  globalThis.sendTelemetryError(error);
});

globalThis.addEventListener('unhandledrejection', ({ reason }) => {
  globalThis.sendTelemetryError(reason);
});
