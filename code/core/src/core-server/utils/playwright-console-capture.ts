import { Page } from 'playwright-core';
import { ConsoleLog } from './run-reporter';

/**
 * Captures console output from a Playwright page and filters to log/warn/error levels.
 * Calls the provided callback for each log entry.
 */
export class PlaywrightConsoleCapture {
  /**
   * Attach listener to page console events.
   * @param page Playwright Page instance
   * @param onLog Callback invoked for each console message at log/warn/error level
   */
  static attach(page: Page, onLog: (log: ConsoleLog) => void): void {
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
  }
}
