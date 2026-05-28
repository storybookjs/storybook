import { MANAGER_INERT_ATTRIBUTE_CHANGED, TELEMETRY_ERROR } from 'storybook/internal/core-events';

import { global } from '@storybook/global';

import { globalPackages, globalsNameReferenceMap } from './globals/globals.ts';
import { globalsNameValueMap } from './globals/runtime.ts';
import { maybeSetupPreviewNavigator } from './preview-navigator.ts';
import { prepareForTelemetry } from './utils.ts';

function setInert(inert: boolean) {
  if (inert) {
    document.body?.setAttribute('inert', 'true');
  } else {
    document.body?.removeAttribute('inert');
  }
}

function errorListener(args: any) {
  const error = args.error || args;
  if (error.fromStorybook) {
    global.sendTelemetryError(error);
  }
}

function unhandledRejectionListener({ reason }: any) {
  if (reason.fromStorybook) {
    global.sendTelemetryError(reason);
  }
}

export function setup() {
  // Apply all the globals
  globalPackages.forEach((key) => {
    (global as any)[globalsNameReferenceMap[key]] = globalsNameValueMap[key];
  });

  global.sendTelemetryError = (error: any) => {
    const channel = global.__STORYBOOK_ADDONS_CHANNEL__;
    channel.emit(TELEMETRY_ERROR, prepareForTelemetry(error));
  };

  const freeze = new URLSearchParams(global.location?.search ?? '').get('freeze') === 'finished';
  if (freeze) {
    setInert(true);
  }

  /**
   * Ensure we synchronise the preview runtime's inert state with the manager's. The inert attribute
   * used to be propagated into iframes, but this has changed, breaking focus trap implementations
   * that rely on inert on the document root. We synchronise inert to ensure end user components
   * don't programmatically focus when a focus trap is active in the manager UI. Otherwise, the UI
   * could reach a deadlock state and be unusable.
   */
  document.addEventListener('DOMContentLoaded', () => {
    if (freeze) {
      setInert(true);
    }

    const channel = global.__STORYBOOK_ADDONS_CHANNEL__;
    channel.on(MANAGER_INERT_ATTRIBUTE_CHANGED, (isInert: boolean) => {
      setInert(freeze || isInert);
    });
  });

  // handle all uncaught StorybookError at the root of the application and log to telemetry if applicable
  global.addEventListener('error', errorListener);
  global.addEventListener('unhandledrejection', unhandledRejectionListener);
  maybeSetupPreviewNavigator();
}

// TODO: In the future, remove this call to make the module side-effect free
// when the webpack builder also imports this as a regular file
setup();
