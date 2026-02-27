import { type StoryRunOptions } from 'storybook/internal/types';

import { nanoid } from 'nanoid';
import type { Browser } from 'playwright-core';

import type { RunStoryChannel } from './server-channel/run-story-channel';
import { PlaywrightConsoleCapture } from './utils/playwright-console-capture';
import type {
  ConsoleLog,
  RunReporterInterface,
  RunResult,
  StoryResult,
} from './utils/run-reporter';

/** Runs stories via Playwright, orchestrating browser automation and result reporting. */
export class StoryRunner {
  private options: StoryRunOptions;
  private serverUrl: string;
  private runStoryChannel: RunStoryChannel;
  private reporter: RunReporterInterface;
  private storyIdToPath: Record<string, string>;
  private browser: Browser;

  constructor(
    options: StoryRunOptions,
    serverUrl: string,
    runStoryChannel: RunStoryChannel,
    reporter: RunReporterInterface,
    storyIdToPath: Record<string, string>,
    browser: Browser
  ) {
    this.options = options;
    this.serverUrl = serverUrl;
    this.runStoryChannel = runStoryChannel;
    this.reporter = reporter;
    this.storyIdToPath = storyIdToPath;
    this.browser = browser;
  }

  /** Run all configured stories and return aggregated results. */
  async run(): Promise<RunResult> {
    const runSessionId = nanoid();
    const results: StoryResult[] = [];

    // Notify reporter of run start
    this.reporter.onRunStart(this.options.storyIds);

    try {
      // Process each story
      for (const storyId of this.options.storyIds) {
        // Early exit if bail is enabled and a story has already failed
        if (this.options.bail && results.some((r) => r.status === 'failed')) {
          const skippedResult: StoryResult = {
            id: storyId,
            status: 'skipped',
            storyPath: this.storyIdToPath[storyId],
          };
          results.push(skippedResult);
          this.reporter.onStoryResult(skippedResult);
          continue;
        }

        // Notify reporter of story start
        this.reporter.onStoryStart(storyId);

        // Create a fresh page for this story
        const page = await this.browser.newPage();
        const consoleLogs: ConsoleLog[] = [];

        try {
          // Attach console capture
          PlaywrightConsoleCapture.attach(page, (log) => {
            consoleLogs.push(log);
            this.reporter.onConsoleLog(storyId, log);
          });

          // Build URL with story ID and session ID
          const storyUrl = `${this.serverUrl}iframe.html?id=${encodeURIComponent(storyId)}&viewMode=story&runSessionId=${encodeURIComponent(runSessionId)}`;

          // Register wait BEFORE navigation to ensure we catch events emitted during load
          const waitForStoryPromise = this.runStoryChannel.waitForStory(storyId, runSessionId);

          // Record start time
          const startTime = Date.now();

          // Navigate to the story — 'commit' is enough since story completion
          // is signaled via the server channel, not page load events
          await page.goto(storyUrl, { waitUntil: 'commit' });

          // Race the registered wait against timeout
          const result = await Promise.race([
            waitForStoryPromise,
            new Promise<StoryResult>((resolve) => {
              setTimeout(() => {
                resolve({
                  id: storyId,
                  status: 'failed',
                  storyPath: this.storyIdToPath[storyId],
                  error: `timed out after ${this.options.timeout}ms`,
                });
              }, this.options.timeout);
            }),
          ]);

          // Compute duration
          const duration = Date.now() - startTime;

          // Extract error-level logs and append to error message only when the story failed
          const errorLogs = consoleLogs.filter((log) => log.level === 'error');
          let finalError = result.error;
          let finalStacktrace = result.stacktrace;
          if (errorLogs.length > 0) {
            result.status = 'failed';
            const browserErrors = errorLogs.map((log) => log.text).join('\n');
            finalError = finalError
              ? `${finalError}\n\nBrowser errors:\n${browserErrors}`
              : browserErrors;
            const stacktraces = errorLogs
              .filter((log) => log.stacktrace)
              .map((log) => log.stacktrace!);
            if (stacktraces.length > 0) {
              finalStacktrace = finalStacktrace
                ? `${finalStacktrace}\n\nBrowser error stacktraces:\n${stacktraces.join('\n\n')}`
                : `Browser error stacktraces:\n${stacktraces.join('\n\n')}`;
            }
          }

          // Merge console logs and duration into result
          const finalResult: StoryResult = {
            ...result,
            ...(finalError && { error: finalError }),
            ...(finalStacktrace && { stacktrace: finalStacktrace }),
            storyPath: this.storyIdToPath[storyId],
            consoleLogs,
            duration,
          };

          results.push(finalResult);
          this.reporter.onStoryResult(finalResult);
        } catch (error) {
          // If any error occurs, clean up the pending wait
          this.runStoryChannel.cancelWait(runSessionId, storyId);
          throw error;
        } finally {
          // Always clean up pending waits when exiting story context
          this.runStoryChannel.cancelWait(runSessionId, storyId);
          // Always close the page
          await page.close();
        }
      }

      // Compute summary counts
      const passed = results.filter((r) => r.status === 'passed').length;
      const failed = results.filter((r) => r.status === 'failed').length;
      const skipped = results.filter((r) => r.status === 'skipped').length;

      const runResult: RunResult = {
        passed,
        failed,
        skipped,
        stories: results,
      };

      // Notify reporter of run completion
      this.reporter.onRunEnd(runResult);

      // Handle keep-open option
      if (this.options.keepOpen) {
        this.reporter.onKeepOpen(this.serverUrl);
        // In production, this would block indefinitely; for now, just return
      }

      return runResult;
    } finally {
      // Always close browser
      await this.browser.close();
    }
  }
}
