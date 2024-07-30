import { global } from '@storybook/global';

import { TELEMETRY_ERROR } from '@storybook/core/core-events';

import { globalsNameValueMap } from './globals/runtime';
import { globalPackages, globalsNameReferenceMap } from './globals/globals';
import { prepareForTelemetry, shouldSkipError } from './utils/prepareForTelemetry';

// Apply all the globals
globalPackages.forEach((key) => {
  global[globalsNameReferenceMap[key]] = globalsNameValueMap[key];
});

global.sendTelemetryError = (error) => {
  if (!shouldSkipError(error)) {
    const channel = global.__STORYBOOK_ADDONS_CHANNEL__;
    channel.emit(TELEMETRY_ERROR, prepareForTelemetry(error));
  }
};

// handle all uncaught errors at the root of the application and log to telemetry
global.addEventListener('error', (args) => {
  // @ts-expect-error (not Event)
  const error = args.error || args;
  global.sendTelemetryError(error);
});

// @ts-expect-error (not Event)
global.addEventListener('unhandledrejection', ({ reason }) => {
  global.sendTelemetryError(reason);
});
