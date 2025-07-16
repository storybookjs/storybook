/* eslint-disable local-rules/no-uncategorized-errors */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { type RunnerTask, type TaskMeta, type TestContext } from 'vitest';

import type { StoryContext } from 'storybook/internal/csf';

import { type Page } from '@playwright/test';

// Type definitions for globals
declare global {
  // this is defined in setup-page.ts and can be used for logging from the browser to node, helpful for debugging
  const logToPage: (message: string) => Promise<void>;
}

export const convertToFilePath = (url: string): string => {
  // Remove the file:// protocol
  const path = url.replace(/^file:\/\//, '');
  // Handle Windows paths
  const normalizedPath = path.replace(/^\/+([a-zA-Z]:)/, '$1');
  // Convert %20 to spaces
  return normalizedPath.replace(/%20/g, ' ');
};

export async function prepareScript(page: Page) {
  await page.goto('http://localhost:6006/iframe.html', { waitUntil: 'load' }).catch((err) => {
    if (err.message?.includes('ERR_CONNECTION_REFUSED')) {
      const errorMessage = `Could not access the Storybook instance at http://localhost:6006. Are you sure it's running?\n\n${err.message}`;
      throw new Error(errorMessage);
    }

    throw err;
  });

  await page.exposeBinding('logToPage', (_, message) => console.log(message));
}

export async function setupPageScript(page: Page) {
  await page.evaluate(async () => {
    type ConsoleMethod =
      | 'log'
      | 'info'
      | 'warn'
      | 'error'
      | 'trace'
      | 'debug'
      | 'group'
      | 'groupCollapsed'
      | 'table'
      | 'dir';
    type LogLevel = 'none' | 'info' | 'warn' | 'error' | 'verbose';

    // All of these variables will be replaced once this file is processed.
    const TEST_RUNNER_STORYBOOK_URL: string = 'http://localhost:6006';
    const TEST_RUNNER_VERSION: string = '1.0.0';
    const TEST_RUNNER_FAIL_ON_CONSOLE: string = 'true';
    const TEST_RUNNER_RENDERED_EVENT: string = 'storyFinished';
    const TEST_RUNNER_VIEW_MODE: string = 'story';
    const TEST_RUNNER_LOG_LEVEL = 'verbose' as LogLevel;
    const TEST_RUNNER_DEBUG_PRINT_LIMIT = 1000;

    // Type definitions for function parameters and return types
    type Colorizer = (message: string) => string;

    const bold: Colorizer = (message: string) => `\u001b[1m${message}\u001b[22m`;
    const magenta: Colorizer = (message: string) => `\u001b[35m${message}\u001b[39m`;
    const blue: Colorizer = (message: string) => `\u001b[34m${message}\u001b[39m`;
    const red: Colorizer = (message: string) => `\u001b[31m${message}\u001b[39m`;
    const yellow: Colorizer = (message: string) => `\u001b[33m${message}\u001b[39m`;
    const grey: Colorizer = (message: string) => `\u001b[90m${message}\u001b[39m`;

    // Constants
    const LIMIT_REPLACE_NODE = '[...]';
    const CIRCULAR_REPLACE_NODE = '[Circular]';

    // Arrays for tracking replacements
    const arr: any[] = [];
    const replacerStack: any[] = [];

    // Default options for stringification
    function defaultOptions(): { depthLimit: number; edgesLimit: number } {
      return {
        depthLimit: Number.MAX_SAFE_INTEGER,
        edgesLimit: Number.MAX_SAFE_INTEGER,
      };
    }

    // Stringify function
    function stringify(
      obj: any,
      replacer: ((key: string, value: any) => any) | null,
      spacer: string | number | null,
      options?: { depthLimit: number; edgesLimit: number }
    ): string {
      if (typeof options === 'undefined') {
        options = defaultOptions();
      }

      decirc(obj, '', 0, [], undefined, 0, options);
      let res: string;
      try {
        if (replacerStack.length === 0) {
          // @ts-expect-error TODO: check why TS complains about this
          res = JSON.stringify(obj, replacer, spacer);
        } else {
          // @ts-expect-error TODO: check why TS complains about this
          res = JSON.stringify(obj, replaceGetterValues(replacer), spacer);
        }
      } catch (_) {
        return JSON.stringify(
          '[unable to serialize, circular reference is too complex to analyze]'
        );
      } finally {
        while (arr.length !== 0) {
          const part = arr.pop();
          if (part && part.length === 4) {
            Object.defineProperty(part[0], part[1], part[3]);
          } else if (part) {
            part[0][part[1]] = part[2];
          }
        }
      }
      return res;
    }

    // Handle circular references and limits
    function decirc(
      val: any,
      k: string,
      edgeIndex: number,
      stack: any[],
      parent: any | undefined,
      depth: number,
      options: { depthLimit: number; edgesLimit: number }
    ): void {
      depth += 1;
      let i: number;
      if (typeof val === 'object' && val !== null) {
        for (i = 0; i < stack.length; i++) {
          if (stack[i] === val) {
            setReplace(CIRCULAR_REPLACE_NODE, val, k, parent);
            return;
          }
        }

        if (depth > options.depthLimit || edgeIndex + 1 > options.edgesLimit) {
          setReplace(LIMIT_REPLACE_NODE, val, k, parent);
          return;
        }

        stack.push(val);
        if (Array.isArray(val)) {
          for (i = 0; i < val.length; i++) {
            decirc(val[i], i.toString(), i, stack, val, depth, options);
          }
        } else {
          const keys = Object.keys(val);
          for (i = 0; i < keys.length; i++) {
            const key = keys[i];
            decirc(val[key], key, i, stack, val, depth, options);
          }
        }
        stack.pop();
      }
    }

    // Set replacement values in objects
    function setReplace(replace: any, val: any, k: string, parent: any | undefined): void {
      if (!parent) {
        return;
      }
      const propertyDescriptor = Object.getOwnPropertyDescriptor(parent, k);
      if (propertyDescriptor && propertyDescriptor.get !== undefined) {
        if (propertyDescriptor.configurable) {
          Object.defineProperty(parent, k, { value: replace });
          arr.push([parent, k, val, propertyDescriptor]);
        } else {
          replacerStack.push([val, k, replace]);
        }
      } else {
        parent[k] = replace;
        arr.push([parent, k, val]);
      }
    }

    // Replace getter values
    function replaceGetterValues(
      replacer?: (this: any, key: string, value: any) => any
    ): (this: any, key: string, value: any) => any {
      const effectiveReplacer = replacer ?? ((_k: string, v: any) => v);
      return function (this: any, key: string, val: any): any {
        if (replacerStack.length > 0) {
          for (let i = 0; i < replacerStack.length; i++) {
            const part = replacerStack[i];
            if (part[1] === key && part[0] === val) {
              val = part[2];
              replacerStack.splice(i, 1);
              break;
            }
          }
        }
        return effectiveReplacer.call(this, key, val);
      };
    }

    // Compose message function
    function composeMessage(args: any): string {
      if (args instanceof Error) {
        return `${args.name}: ${args.message}\n${args.stack}`;
      }

      if (typeof args === 'undefined') {
        return 'undefined';
      }

      if (typeof args === 'string') {
        return args;
      }
      return stringify(args, null, null, { depthLimit: 5, edgesLimit: 100 });
    }

    // Truncate long strings
    function truncate(input: string, limit: number): string {
      if (input.length > limit) {
        return input.substring(0, limit) + '…';
      }
      return input;
    }

    // Add extra information to the user agent
    function addToUserAgent(extra: string): void {
      // eslint-disable-next-line compat/compat
      const originalUserAgent = globalThis.navigator.userAgent;
      if (!originalUserAgent.includes(extra)) {
        Object.defineProperty(globalThis.navigator, 'userAgent', {
          get: function () {
            return [originalUserAgent, extra].join(' ');
          },
          configurable: true,
        });
      }
    }

    function getStory(): StoryContext {
      // @ts-expect-error TODO: fix later
      const currentRender = globalThis.__STORYBOOK_PREVIEW__.currentRender;
      if (currentRender && 'story' in currentRender) {
        return currentRender.story as unknown as StoryContext;
      }

      return {} as StoryContext;
    }

    // Custom error class
    class StorybookTestRunnerError extends Error {
      constructor(params: {
        storyId: string;
        errorMessage: string;
        logs?: string[];
        isMessageFormatted?: boolean;
      }) {
        const { storyId, errorMessage, logs = [], isMessageFormatted = false } = params;
        const message = isMessageFormatted
          ? errorMessage
          : StorybookTestRunnerError.buildErrorMessage({
              storyId,
              errorMessage,
              logs,
            });
        super(message);

        this.name = 'StorybookTestRunnerError';
      }

      public static buildErrorMessage(params: {
        storyId: string;
        errorMessage: string;
        logs?: string[];
        panel?: string;
        errorMessagePrefix?: string;
      }): string {
        const { storyId, errorMessage, logs = [], panel, errorMessagePrefix = '' } = params;
        const storyUrl = `${TEST_RUNNER_STORYBOOK_URL}?path=/story/${storyId}`;
        const finalStoryUrl = panel ? `${storyUrl}&addonPanel=${panel}` : storyUrl;
        const separator = '\n\n--------------------------------------------------';
        // The original error message will also be collected in the logs, so we filter it to avoid duplication
        const finalLogs = logs.filter((err: string) => !err.includes(errorMessage));
        const extraLogs =
          finalLogs.length > 0 ? separator + '\n\nBrowser logs:\n\n' + finalLogs.join('\n\n') : '';

        const linkPrefix = blue(
          `\nClick to debug the error directly in Storybook:\n${finalStoryUrl}\n\n`
        );

        const message = `${errorMessagePrefix}${linkPrefix}Message:\n ${truncate(
          errorMessage,
          TEST_RUNNER_DEBUG_PRINT_LIMIT
        )}\n${extraLogs}`;

        return message;
      }
    }

    // Wait for Storybook to load
    async function __waitForStorybook(): Promise<void> {
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject();
        }, 10000);

        if (document.querySelector('#root') || document.querySelector('#storybook-root')) {
          clearTimeout(timeout);
          return resolve();
        }

        const observer = new MutationObserver(() => {
          if (document.querySelector('#root') || document.querySelector('#storybook-root')) {
            clearTimeout(timeout);
            resolve();
            observer.disconnect();
          }
        });

        observer.observe(document.body, {
          childList: true,
          subtree: true,
        });
      });
    }

    function isServerComponentError(error: unknown) {
      return (
        typeof error === 'string' &&
        (error.includes('Only Server Components can be async at the moment.') ||
          error.includes('A component was suspended by an uncached promise.') ||
          error.includes('async/await is not yet supported in Client Components'))
      );
    }

    function expectToHaveNoViolations(results: any): { long: string; short: string } | null {
      const violations = filterViolations(
        results.violations,
        // `impactLevels` is not a valid toolOption but one we add to the config
        // when calling `run`. axe just happens to pass this along. Might be a safer
        // way to do this since it's not documented API.
        results.toolOptions?.impactLevels ?? []
      );

      function reporter(violations: any) {
        if (violations.length === 0) {
          return null;
        }

        const lineBreak = '\n\n';
        const horizontalLine = '\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500';

        return violations
          .map((violation: any) => {
            const errorBody = violation.nodes
              .map((node: any) => {
                const selector = node.target.join(', ');
                const expectedText =
                  red(`Expected the HTML found at $('${selector}') to have no violations:`) +
                  lineBreak;
                return (
                  expectedText +
                  grey(node.html) +
                  lineBreak +
                  red(`Received:`) +
                  lineBreak +
                  red(`"${violation.help} (${violation.id})"`) +
                  lineBreak +
                  yellow(node.failureSummary) +
                  lineBreak +
                  (violation.helpUrl
                    ? red(`You can find more information on this issue here:`) +
                      `\n${blue(violation.helpUrl)}`
                    : '')
                );
              })
              .join(lineBreak);
            return errorBody;
          })
          .join(lineBreak + horizontalLine + lineBreak);
      }

      const formatedViolations = reporter(violations);

      return {
        long: formatedViolations,
        short: `Found ${violations.length} a11y violations, run the test with 'a11y: { test: 'error' }' parameter to see the full report or debug it directly in Storybook.`,
      };
    }

    function filterViolations(violations: any, impactLevels: Array<any>) {
      if (impactLevels && impactLevels.length > 0) {
        return violations.filter((v: any) => impactLevels.includes(v.impact));
      }
      return violations;
    }

    async function __test(storyId: string): Promise<any> {
      try {
        await __waitForStorybook();
      } catch (err) {
        const message = `Timed out waiting for Storybook to load after 10 seconds. Are you sure the Storybook is running correctly in that URL? Is the Storybook private (e.g. under authentication layers)?\n\n\nHTML: ${document.body.innerHTML}`;
        throw new StorybookTestRunnerError({ storyId, errorMessage: message });
      }

      const channel = globalThis.__STORYBOOK_ADDONS_CHANNEL__;
      if (!channel) {
        throw new StorybookTestRunnerError({
          storyId,
          errorMessage:
            'The test runner could not access the Storybook channel. Are you sure the Storybook is running correctly in that URL?',
        });
      }

      addToUserAgent(`(StorybookTestRunner@${TEST_RUNNER_VERSION})`);

      // Collect logs to show upon test error
      const logs: string[] = [];
      let hasErrors = false;

      const logLevelMapping: { [key in ConsoleMethod]: LogLevel[] } = {
        log: ['info', 'verbose'],
        warn: ['info', 'warn', 'verbose'],
        error: ['info', 'warn', 'error', 'verbose'],
        info: ['verbose'],
        trace: ['verbose'],
        debug: ['verbose'],
        group: ['verbose'],
        groupCollapsed: ['verbose'],
        table: ['verbose'],
        dir: ['verbose'],
      };

      const spyOnConsole = (method: ConsoleMethod, name: string): void => {
        const originalFn = console[method].bind(console);
        console[method] = function (...args: any[]) {
          const isConsoleError = method === 'error';
          // Storybook nextjs/react supress error logs from server components and so should the test-runner
          if (isConsoleError && isServerComponentError(args[0])) {
            return;
          }

          const shouldCollectError = TEST_RUNNER_FAIL_ON_CONSOLE === 'true' && method === 'error';
          if (shouldCollectError) {
            hasErrors = true;
          }

          let message = args.map(composeMessage).join(', ');
          if (method === 'trace') {
            const stackTrace = new Error().stack;
            message += `\n${stackTrace}\n`;
          }

          if (logLevelMapping[method].includes(TEST_RUNNER_LOG_LEVEL) || shouldCollectError) {
            const prefix = `${bold(name)}: `;
            logs.push(prefix + message);
          }

          originalFn(...args);
        };
      };

      // Console methods + color function for their prefix
      const spiedMethods: { [key: string]: Colorizer } = {
        // info
        log: blue,
        info: blue,
        // warn
        warn: yellow,
        // error
        error: red,
        // verbose
        dir: magenta,
        trace: magenta,
        group: magenta,
        groupCollapsed: magenta,
        table: magenta,
        debug: magenta,
      };

      Object.entries(spiedMethods).forEach(([method, color]) => {
        spyOnConsole(method as ConsoleMethod, color(method));
      });

      const cleanup = (_listeners: Record<string, (...args: any[]) => void>) => {
        Object.entries(_listeners).forEach(([eventName, listener]) => {
          channel.off(eventName, listener);
        });
      };

      return new Promise((resolve, reject) => {
        const rejectWithFormattedError = (storyId: string, message: string, panel?: string) => {
          const errorMessage = StorybookTestRunnerError.buildErrorMessage({
            storyId,
            errorMessage: message,
            logs,
            panel,
          });

          reject(
            new StorybookTestRunnerError({
              storyId,
              errorMessage,
              logs,
              isMessageFormatted: true,
            })
          );
        };

        const INTERACTIONS_PANEL = 'storybook/interactions/panel';
        const A11Y_PANEL = 'storybook/a11y/panel';

        const listeners = {
          [TEST_RUNNER_RENDERED_EVENT]: (data: any) => {
            cleanup(listeners);

            if (hasErrors) {
              rejectWithFormattedError(storyId, 'Browser console errors');
              return;
            } else if (data?.reporters) {
              const story = getStory();
              const a11yGlobals = story.globals?.a11y;
              const a11yParameter = story.parameters?.a11y;
              const a11yTestParameter = a11yParameter?.test;
              const a11yReport = data.reporters.find((reporter: any) => reporter.type === 'a11y');

              const shouldRunA11yTest =
                a11yParameter?.disable !== true &&
                a11yParameter?.test !== 'off' &&
                a11yGlobals?.manual !== true &&
                a11yReport?.result?.violations?.length > 0;

              if (shouldRunA11yTest) {
                const violations = expectToHaveNoViolations(a11yReport.result);
                if (violations && a11yTestParameter === 'error') {
                  rejectWithFormattedError(storyId, violations.long, A11Y_PANEL);
                  return;
                } else if (violations && a11yTestParameter === 'todo') {
                  const warningMessage = StorybookTestRunnerError.buildErrorMessage({
                    storyId,
                    errorMessagePrefix: `--------------------------\n${story.title} > ${story.name}`,
                    errorMessage: yellow(violations.short),
                    logs,
                    panel: A11Y_PANEL,
                  });
                  logToPage(warningMessage);
                }
              }
            }

            resolve(document.getElementById('root'));
          },

          storyUnchanged: () => {
            cleanup(listeners);
            resolve(document.getElementById('root'));
          },

          storyErrored: ({ description }: { description: string }) => {
            cleanup(listeners);
            rejectWithFormattedError(storyId, description, INTERACTIONS_PANEL);
          },

          storyThrewException: (error: Error) => {
            cleanup(listeners);
            rejectWithFormattedError(storyId, error.message, INTERACTIONS_PANEL);
          },

          playFunctionThrewException: (error: Error) => {
            cleanup(listeners);

            rejectWithFormattedError(storyId, error.message, INTERACTIONS_PANEL);
          },

          unhandledErrorsWhilePlaying: ([error]: Error[]) => {
            cleanup(listeners);
            rejectWithFormattedError(storyId, error.message, INTERACTIONS_PANEL);
          },

          storyMissing: (id: string) => {
            cleanup(listeners);
            if (id === storyId) {
              rejectWithFormattedError(storyId, 'The story was missing when trying to access it.');
            }
          },
        };

        Object.entries(listeners).forEach(([eventName, listener]) => {
          channel.on(eventName, listener);
        });

        channel.emit('setCurrentStory', {
          storyId,
          viewMode: TEST_RUNNER_VIEW_MODE,
        });
      });
    }
    // @ts-expect-error Need to fix with augmentation
    globalThis.__test = __test;
  });
}

export function testStory(storyId: string, page: Page) {
  return async (context: TestContext) => {
    const _task = context.task as RunnerTask & {
      meta: TaskMeta & { storyId: string; reports: Report[] };
    };
    _task.meta.storyId = storyId;

    await page.evaluate(async (storyId: string) => {
      // @ts-expect-error Need to fix with augmentation
      return await globalThis.__test(storyId);
    }, storyId);
  };
}
