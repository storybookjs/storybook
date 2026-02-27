import type { Page } from 'playwright-core';

import type { ConsoleLog } from './run-reporter';

/**
 * Captures console output and errors from a Playwright page. Handles console messages, uncaught
 * exceptions, and unhandled promise rejections. Calls the provided callback for each log entry.
 */
export class PlaywrightConsoleCapture {
  /**
   * Attach listener to page console events, page errors, and unhandled rejections.
   *
   * @param page Playwright Page instance
   * @param onLog Callback invoked for each console message, error, or rejection
   */
  static attach(page: Page, onLog: (log: ConsoleLog) => void): void {
    // Capture console.log, console.warn, console.error
    page.on('console', (msg) => {
      const level = msg.type();
      if (level === 'log' || level === 'warn' || level === 'error') {
        onLog({
          level: level as 'log' | 'warn' | 'error',
          text: msg.text(),
          timestamp: Date.now(),
        });
      }
    });

    // Capture uncaught exceptions
    page.on('pageerror', (err) => {
      onLog({
        level: 'error',
        text: `Uncaught exception: ${err.message}`,
        stacktrace: err.stack,
        timestamp: Date.now(),
      });
    });
  }
}
