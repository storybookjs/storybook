import {
  RESET_STORY_ARGS,
  STORY_RENDERED,
  UPDATE_STORY_ARGS,
} from 'storybook/internal/core-events';

import { addons } from 'storybook/preview-api';
import { expect, userEvent, waitFor } from 'storybook/test';

import Button from './Button.svelte';

export default {
  component: Button,
  tags: ['!vitest'],
};

export const UpdatingArgs = {
  play: async ({ canvas, id, step }) => {
    const channel = addons.getChannel();

    await step('Reset story args', async () => {
      // Just to ensure the story is always in a clean state from the beginning, not really part of the test
      channel.emit(RESET_STORY_ARGS, { storyId: id });
      await new Promise((resolve) => {
        channel.once(STORY_RENDERED, resolve);
      });
      await waitFor(async () => {
        await expect(canvas.getByRole('button')).toHaveTextContent('You clicked: 0');
      });
    });

    await step('Change state', async () => {
      await userEvent.click(canvas.getByRole('button'));
      await waitFor(async () => {
        await expect(canvas.getByRole('button')).toHaveTextContent('You clicked: 1');
      });
    });

    await step("Update story args with { text: 'Changed' }", async () => {
      channel.emit(UPDATE_STORY_ARGS, { storyId: id, updatedArgs: { text: 'Changed' } });
      await new Promise((resolve) => {
        channel.once(STORY_RENDERED, resolve);
      });
      await waitFor(async () => {
        await expect(canvas.getByRole('button')).toHaveTextContent('Changed: 1');
      });
    });
  },
};

export const RemountOnResetStoryArgs = {
  play: async (playContext) => {
    await UpdatingArgs.play(playContext);

    const channel = addons.getChannel();
    const { canvas, id, step } = playContext;

    // expect that all state and args are reset after RESET_STORY_ARGS because Svelte needs to remount the component
    // most other renderers would have 'You clicked: 1' here because they don't remount the component
    // if this doesn't fully remount it would be 'undefined: 1' because undefined args are used as is in Svelte, and the state is kept
    await step('Reset story args', () => channel.emit(RESET_STORY_ARGS, { storyId: id }));

    await waitFor(async () => {
      await expect(canvas.getByRole('button')).toHaveTextContent('You clicked: 0');
    });
  },
};
