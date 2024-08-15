/* eslint-disable @typescript-eslint/naming-convention */

/* eslint-disable no-underscore-dangle */
import { afterAll, vi } from 'vitest';
import type { RunnerTask, TaskMeta } from 'vitest';

import { Channel } from 'storybook/internal/channels';

declare global {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore - The module is augmented elsewhere but we need to duplicate it to avoid issues in no-link mode.
  // eslint-disable-next-line no-var
  var __STORYBOOK_ADDONS_CHANNEL__: Channel;
}

type ExtendedMeta = TaskMeta & { storyId: string; hasPlayFunction: boolean };

const transport = { setHandler: vi.fn(), send: vi.fn() };
globalThis.__STORYBOOK_ADDONS_CHANNEL__ = new Channel({ transport });

// The purpose of this set up file is to modify the error message of failed tests
// and inject a link to the story in Storybook
const modifyErrorMessage = (currentTask: RunnerTask) => {
  const meta = currentTask.meta as ExtendedMeta;
  if (
    currentTask.type === 'test' &&
    currentTask.result?.state === 'fail' &&
    meta.storyId &&
    currentTask.result.errors?.[0]
  ) {
    const currentError = currentTask.result.errors[0];
    const storybookUrl = import.meta.env.__STORYBOOK_URL__;
    const storyUrl = `${storybookUrl}/?path=/story/${meta.storyId}&addonPanel=storybook/interactions/panel`;
    currentError.message = `\n\x1B[34mClick to debug the error directly in Storybook: ${storyUrl}\x1B[39m\n\n${currentError.message}`;
  }
};

afterAll((suite) => {
  suite.tasks.forEach(modifyErrorMessage);
});
