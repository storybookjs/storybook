import type { FC } from 'react';
import React, { createContext, useContext } from 'react';

import type { Meta, StoryObj } from '@storybook/react';

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

// This story will error if `parameters.docs.source.excludeDecorators` is true:
// See https://github.com/storybookjs/storybook/issues/21900
const TestContext = createContext<boolean>(false);
export const Context: StoryObj<typeof Component> = {
  // parameters: { docs: { source: { excludeDecorators: true } } },
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
