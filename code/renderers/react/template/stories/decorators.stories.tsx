import type { FC } from 'react';
import React, { createContext, useContext, useState } from 'react';

import type { Meta, StoryObj } from '@storybook/react';

import { useParameter } from 'storybook/preview-api';

const Component: FC = () => <p>Story</p>;

export default {
  component: Component,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <>
        <p>Component Decorator</p>
        <Story />
      </>
    ),
  ],
} as Meta<typeof Component>;

export const All: StoryObj<typeof Component> = {
  decorators: [
    (Story) => (
      <>
        <p>Local Decorator</p>
        <Story />
      </>
    ),
  ],
};

// This story should not error
// See https://github.com/storybookjs/storybook/issues/21900
const TestContext = createContext<boolean>(false);
export const Context: StoryObj<typeof Component> = {
  parameters: { docs: { source: { excludeDecorators: true } } },
  decorators: [
    (Story) => (
      <TestContext.Provider value>
        <Story />
      </TestContext.Provider>
    ),
  ],
  render: function Render(args, context) {
    const value = useContext(TestContext);

    if (!value) {
      throw new Error('TestContext not set, decorator did not run!');
    }
    return <p>Story</p>;
  },
};

/**
 * This story demonstrates is a regression test for this issue with React hooks in Storybook
 * (https://github.com/storybookjs/storybook/issues/29189)
 *
 * Which happened when a decorator was using storybook hooks, and the render react hooks.
 */
export const AllowUseStateInRender: StoryObj = {
  render: () => {
    const [count, setCount] = useState(0);
    const Button = (globalThis as any).__TEMPLATE_COMPONENTS__.Button;
    return <Button onClick={() => setCount(count + 1)} label={`Clicked ${count} times`} />;
  },
  decorators: [
    (storyFn) => {
      useParameter('docs', {});
      return storyFn();
    },
  ],
  play: async ({ canvas, userEvent }) => {
    const button = await canvas.findByText('Clicked 0 times');
    await userEvent.click(button);
    await canvas.findByText('Clicked 1 times');
  },
  tags: ['!vitest'],
};
