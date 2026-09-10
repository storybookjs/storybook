import { beforeAll, vi } from 'vitest';
import type { RunnerTask } from 'vitest';

import { Channel } from 'storybook/internal/channels';
import { getChannel, setChannel } from 'storybook/internal/channels';

import { COMPONENT_TESTING_PANEL_ID } from '../constants.ts';

declare global {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore - The module is augmented elsewhere but we need to duplicate it to avoid issues in no-link mode.
  var __STORYBOOK_ADDONS_CHANNEL__: Channel;
}

export type Task = Partial<RunnerTask> & {
  meta: Record<string, any>;
};

let defaultChannel: Channel | null = null;

export const initTransport = () => {
  const existing = getChannel();
  if (existing) {
    defaultChannel ??= existing as Channel;
    return;
  }

  const transport = { setHandler: vi.fn(), send: vi.fn() };
  const channel = new Channel({ transport });
  defaultChannel = channel;
  setChannel(channel);
};

/** Restore the channel installed for story tests (e.g. after manager stories swap in a mock). */
export const restoreDefaultChannel = () => {
  if (!defaultChannel) {
    initTransport();
    return;
  }

  if (getChannel() !== defaultChannel) {
    setChannel(defaultChannel);
  }
};

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

initTransport();

beforeAll(() => {
  if (globalThis.globalProjectAnnotations) {
    return globalThis.globalProjectAnnotations.beforeAll();
  }
});

export const afterEachStory = (ctx: { task: Task }) => {
  restoreDefaultChannel();
  modifyErrorMessage({ task: ctx.task });
};
