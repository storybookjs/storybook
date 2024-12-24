/* eslint-disable local-rules/no-uncategorized-errors */
import { global } from '@storybook/global';

import { UncaughtManagerError } from '@storybook/core/manager-errors';

import type { BrowserInfo } from 'browser-dtector';
import BrowserDetector from 'browser-dtector';

let browserInfo: BrowserInfo | undefined;

function getBrowserInfo() {
  if (!browserInfo) {
    browserInfo = new BrowserDetector(global.navigator?.userAgent).getBrowserInfo();
  }

  return browserInfo;
}

// If you're adding errors to filter, please explain why they should be filtered.
const errorMessages = [
  // It's a harmless issue with react-resize-detector that supposedly will be gone when we move to React 18.
  // https://github.com/maslianok/react-resize-detector/issues/45#issuecomment-1500958024
  'ResizeObserver loop completed with undelivered notifications.',
  'ResizeObserver loop limit exceeded',
  // Safari does not seem to provide any helpful info on window.onerror
  // https://bugs.webkit.org/show_bug.cgi?id=132945
  'Script error.',
];

export const shouldSkipError = (error: Error) => errorMessages.includes(error?.message);

export function prepareForTelemetry(
  originalError: Error & {
    fromStorybook?: boolean;
    category?: string;
    target?: any;
    currentTarget?: any;
    srcElement?: any;
    browserInfo?: BrowserInfo;
  }
) {
  let error = originalError;

  // DOM manipulation errors and other similar errors are not serializable as they contain
  // circular references to the window object. If that's the case, we make a simplified copy
  if (
    originalError.target === global ||
    originalError.currentTarget === global ||
    originalError.srcElement === global
  ) {
    error = new Error(originalError.message);
    error.name = originalError.name || error.name;
  }

  if (!originalError.fromStorybook) {
    error = new UncaughtManagerError({ error });
  }

  error.browserInfo = getBrowserInfo();

  return error;
}
