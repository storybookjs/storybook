import { global } from '@storybook/global';

import { TELEMETRY_ERROR } from '@storybook/core/core-events';

import { globalPackages, globalsNameReferenceMap } from './globals/globals';
import { globalsNameValueMap } from './globals/runtime';
import { prepareForTelemetry } from './utils';

// Apply all the globals
globalPackages.forEach((key) => {
  (global as any)[globalsNameReferenceMap[key]] = globalsNameValueMap[key];
});

global.sendTelemetryError = (error: any) => {
  const channel = global.__STORYBOOK_ADDONS_CHANNEL__;
  channel.emit(TELEMETRY_ERROR, prepareForTelemetry(error));
};

// handle all uncaught StorybookError at the root of the application and log to telemetry if applicable
global.addEventListener('error', (args: any) => {
  const error = args.error || args;
  if (error.fromStorybook) {
    global.sendTelemetryError(error);
  }
});
global.addEventListener('unhandledrejection', ({ reason }: any) => {
  if (reason.fromStorybook) {
    global.sendTelemetryError(reason);
  }
});
