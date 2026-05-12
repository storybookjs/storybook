import { beforeEach, afterEach, beforeAll, vi } from 'vitest';
import type { RunnerTask } from 'vitest';

import { Channel } from 'storybook/internal/channels';

import { COMPONENT_TESTING_PANEL_ID } from '../constants.ts';
import { isFunction } from 'es-toolkit/predicate';

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

export const resetMousePositionBeforeTests = async () => {
  try {
    const browserCommands = await import('vitest/browser').then((module) => module.commands);
    if ('resetMousePosition' in browserCommands && isFunction(browserCommands.resetMousePosition)) {
      await browserCommands.resetMousePosition();
    }
  } catch (error) {
    // Retry with Vitest 3 context module when vitest/browser is not found.
    if (error instanceof Error && error.message.includes("Cannot find module 'vitest/browser'")) {
      try {
        const browserCommands = await import('@vitest/browser/context').then(
          (module) => module.commands
        );
        if (
          'resetMousePosition' in browserCommands &&
          isFunction(browserCommands.resetMousePosition)
        ) {
          await browserCommands.resetMousePosition();
        }
        return;
      } catch (vitest3Error) {
        if (
          vitest3Error instanceof Error &&
          vitest3Error.message.includes("Cannot find module '@vitest/browser/context'")
        ) {
          return;
        }
        if (
          vitest3Error instanceof Error &&
          vitest3Error.message.includes('can be imported only inside the Browser Mode')
        ) {
          return;
        }
        throw vitest3Error;
      }
    }

    // Ignore "Error: vitest/browser can be imported only inside the Browser Mode."
    if (
      error instanceof Error &&
      error.message.includes('can be imported only inside the Browser Mode')
    ) {
      return;
    }

    // Throw anything else
    throw error;
  }
};

beforeAll(() => {
  if (globalThis.globalProjectAnnotations) {
    return globalThis.globalProjectAnnotations.beforeAll();
  }
});

beforeEach(resetMousePositionBeforeTests);

afterEach(modifyErrorMessage);
