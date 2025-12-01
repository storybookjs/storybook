import { afterEach, beforeAll, vi, expect as vitestExpect } from 'vitest';
import type { RunnerTask } from 'vitest';

import { Channel } from 'storybook/internal/channels';

import { COMPONENT_TESTING_PANEL_ID } from '../constants';

declare global {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore - The module is augmented elsewhere but we need to duplicate it to avoid issues in no-link mode.
  // eslint-disable-next-line no-var
  var __STORYBOOK_ADDONS_CHANNEL__: Channel;
}

export type Task = Partial<RunnerTask> & {
  meta: Record<string, any>;
};

const transport = { setHandler: vi.fn(), send: vi.fn() };
globalThis.__STORYBOOK_ADDONS_CHANNEL__ ??= new Channel({ transport });

export const modifyErrorMessage = ({ task }: { task: Task }) => {
  const meta = task.meta;
  if (
    task.type === 'test' &&
    task.result?.state === 'fail' &&
    meta.storyId &&
    task.result.errors?.[0]
  ) {
    const currentError = task.result.errors[0];
    const storybookUrl = import.meta.env.__STORYBOOK_URL__;
    const storyUrl = `${storybookUrl}/?path=/story/${meta.storyId}&addonPanel=${COMPONENT_TESTING_PANEL_ID}`;
    currentError.message = `\n\x1B[34mClick to debug the error directly in Storybook: ${storyUrl}\x1B[39m\n\n${currentError.message}`;
  }
};

beforeAll(() => {
  if (globalThis.globalProjectAnnotations) {
    return globalThis.globalProjectAnnotations.beforeAll();
  }
});

afterEach(modifyErrorMessage);

/*
 * Setup file for @storybook/addon-vitest to enable Storybook-specific test behaviors.
 *
 * - Marks that the screenshot matcher is available so storybook/test can forward calls.
 */

// Only activate when running via Vitest
if (typeof process !== 'undefined' && process.env?.VITEST === 'true') {
  // Mark the screenshot matcher as available so storybook/test guarded shim does not throw
  (globalThis as any).__STORYBOOK_TEST_HAS_SCREENSHOT_MATCHER__ = true;

  // Wrap Vitest's toMatchScreenshot to emit preview events with fetched base64 data
  try {
    const state = (vitestExpect as any).getState?.() || {};
    const registered = state.matchers?.toMatchScreenshot;
    if (registered) {
      const original = registered;
      (vitestExpect as any).extend({
        async toMatchScreenshot(this: any, ...args: any[]) {
          // Call original matcher first
          const result = await original.call(this, ...args);
          try {
            const userProvidedName = typeof args[0] === 'string' ? args[0] : undefined;
            // TODO: implement proper sanitization
            const sanitizeArg = (s: string) => s;

            const st = (vitestExpect as any).getState?.() || {};
            const testPath: string | undefined =
              st.testPath || (globalThis as any)?.__vitest_worker__?.filepath;
            const currentTestName: string | undefined = st.currentTestName;
            const meta = (st as any)?.meta || {};

            const baseUrl = (import.meta as any).env?.__STORYBOOK_URL__ || '';
            const qs = new URLSearchParams();

            if (testPath) {
              qs.set('testFilePath', testPath);
            }

            if (currentTestName) {
              qs.set('testName', currentTestName);
            }

            if (userProvidedName) {
              qs.set('arg', sanitizeArg(userProvidedName));
            }
            const endpoint = `${baseUrl}/__storybook_test__/api/visual-snapshot/latest?${qs.toString()}`;

            const res = await fetch(endpoint);
            if (res.ok) {
              const data = await res.json();
              const channel = globalThis.__STORYBOOK_ADDONS_CHANNEL__;
              channel?.emit?.('storybook/test:visual-screenshot', {
                storyId: meta?.storyId,
                testName: currentTestName,
                url: data?.dataUri,
                browserName: data?.browserName,
                platform: data?.platform,
                timestamp: Date.now(),
              });
            }
          } catch {
            // non-fatal
          }
          return result;
        },
      });
    }
  } catch {
    // ignore
  }
}

export {};
