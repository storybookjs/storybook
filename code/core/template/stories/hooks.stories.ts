import type { PartialStoryFn, StoryContext } from '@storybook/core/types';
import { global as globalThis } from '@storybook/global';
import { userEvent, within } from '@storybook/test';

import { useEffect, useState } from '@storybook/core/preview-api';

export default {
  component: globalThis.Components.Button,
  tags: ['!vitest'],
};

export const UseState = {
  decorators: [
    (story: PartialStoryFn) => {
      const [count, setCount] = useState(0);
      return story({
        args: {
          label: `Clicked ${count} times`,
          onClick: () => {
            setCount(count + 1);
          },
        },
      });
    },
  ],
  play: async ({ canvasElement }: StoryContext<any>) => {
    const button = await within(canvasElement).findByText('Clicked 0 times');

    await userEvent.click(button);
    await within(canvasElement).findByText('Clicked 1 times');
  },
  // TODO VITEST INTEGRATION: remove this once we support Storybook hooks in portable stories
  tags: ['!vitest'],
};

// NOTE: it isn't possible to write a play function for this story, as the
// useEffect hook doesn't fire until *after* the story has rendered, which includes
// the play function running.
export const UseEffect = {
  decorators: [
    (story: PartialStoryFn) => {
      const [count, setCount] = useState(0);

      useEffect(() => {
        setCount(1);
      }, []);

      return story({
        args: {
          label: count > 0 ? `useEffect worked!` : `useEffect hasn't worked yet!`,
          onClick: () => {},
        },
      });
    },
  ],
};
