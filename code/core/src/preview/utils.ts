import type { BrowserInfo } from 'browser-dtector';
import BrowserDetector from 'browser-dtector';

let browserInfo: BrowserInfo | undefined;

function getBrowserInfo() {
  if (!browserInfo) {
    browserInfo = new BrowserDetector(globalThis.navigator?.userAgent).getBrowserInfo();
  }

  return browserInfo;
}

export function prepareForTelemetry(
  error: Error & {
    fromStorybook?: boolean;
    category?: string;
    target?: any;
    currentTarget?: any;
    srcElement?: any;
    browserInfo?: BrowserInfo;
  }
) {
  error.browserInfo = getBrowserInfo();

  return error;
}
