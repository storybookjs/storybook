import {
  RESET_STORY_ARGS,
  STORY_RENDERED,
  UPDATE_STORY_ARGS,
} from 'storybook/internal/core-events';
import { addons } from 'storybook/internal/preview-api';

import { expect, userEvent, waitFor, within } from '@storybook/test';

import ButtonView from './views/ButtonJavaScript.svelte';

export default {
  component: ButtonView,
  tags: ['!vitest'],
};

export const RemountOnResetStoryArgs = {
  play: async ({ canvasElement, id, step }) => {
    const canvas = await within(canvasElement);
    const channel = addons.getChannel();

    await step('Reset story args', async () => {
      // Just to ensure the story is always in a clean state from the beginning, not really part of the test
      await channel.emit(RESET_STORY_ARGS, { storyId: id });
      await new Promise((resolve) => {
        channel.once(STORY_RENDERED, resolve);
      });
    });
    const button = await canvas.getByRole('button');
    await expect(button).toHaveTextContent('You clicked: 0');

    await userEvent.click(button);

    await waitFor(async () => {
      await expect(button).toHaveTextContent('You clicked: 1');
    });

    await step("Update story args with { text: 'Changed' }", async () => {
      await channel.emit(UPDATE_STORY_ARGS, { storyId: id, updatedArgs: { text: 'Changed' } });
      await new Promise((resolve) => {
        channel.once(STORY_RENDERED, resolve);
      });
    });
    await expect(button).toHaveTextContent('Changed: 1');

    // expect that all state and args are reset after RESET_STORY_ARGS because Svelte needs to remount the component
    // most other renderers would have 'You clicked: 1' here because they don't remount the component
    // if this doesn't fully remount it would be 'undefined: 1' because undefined args are used as is in Svelte, and the state is kept
    await step('Reset story args', () => channel.emit(RESET_STORY_ARGS, { storyId: id }));
    await waitFor(async () =>
      expect(await within(canvasElement).getByRole('button')).toHaveTextContent('You clicked: 0')
    );
  },
};
