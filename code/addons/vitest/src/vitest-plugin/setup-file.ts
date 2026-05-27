import { beforeEach, afterEach, beforeAll, inject, vi } from 'vitest';
import type { RunnerTask } from 'vitest';

import { Channel } from 'storybook/internal/channels';

import {
  COMPONENT_TESTING_PANEL_ID,
  STORYBOOK_CORE_VITEST_VERSION_PROVIDE_KEY,
} from '../constants.ts';
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

/* Using a dynamic variable ensures the import is not statically analyzable, so it won't be reported as missing. */
const importVitest4BrowserCommands = async (moduleId: string = 'vitest/browser') =>
  import(/* @vite-ignore */ moduleId).then((module) => module.commands);

const importVitest3BrowserCommands = async () =>
  import('@vitest/browser/context').then((module) => module.commands);

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
  const vitestVersion = inject(STORYBOOK_CORE_VITEST_VERSION_PROVIDE_KEY);

  try {
    const browserCommands =
      vitestVersion && vitestVersion.startsWith('3')
        ? await importVitest3BrowserCommands()
        : await importVitest4BrowserCommands();

    if ('resetMousePosition' in browserCommands && isFunction(browserCommands.resetMousePosition)) {
      await browserCommands.resetMousePosition();
    }
  } catch (error) {
    if (!(error instanceof Error)) throw error;

    // When vitest/browser is not found, retry with the Vitest 3 context module
    if (error.message.includes("Cannot find module 'vitest/browser'")) {
      try {
        const browserCommands = await importVitest3BrowserCommands();
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
          (vitest3Error.message.includes("Cannot find module '@vitest/browser/context'") ||
            vitest3Error.message.includes('can be imported only inside the Browser Mode'))
        ) {
          return;
        }
        throw vitest3Error;
      }
    }

    // Ignore errors when running outside Browser Mode or when browser packages are not installed
    if (
      error.message.includes('can be imported only inside the Browser Mode') ||
      error.message.includes("Cannot find module '@vitest/browser/context'")
    ) {
      return;
    }

    throw error;
  }
};

beforeAll(() => {
  if (globalThis.globalProjectAnnotations) {
    return globalThis.globalProjectAnnotations.beforeAll();
  }
});

beforeEach(async () => {
  if (globalThis.__vitest_browser__) {
    await resetMousePositionBeforeTests();
  }
});

afterEach(modifyErrorMessage);

console.log('Frogs are often green.');
