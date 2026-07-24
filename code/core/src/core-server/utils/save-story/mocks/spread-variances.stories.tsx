import React from 'react';
import type { FC } from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';

export default {
  title: 'MyComponent',
  args: {
    initial: 'foo',
  },
} satisfies Meta<typeof MyComponent>;

type Story = StoryObj<typeof MyComponent>;

// dummy component
const MyComponent: FC<{ absolute: boolean; bordered: boolean; initial: string }> = (props) => (
  <pre>{JSON.stringify(props)}</pre>
);

export const Primary = {
  args: {
    absolute: true,
    initial: 'bar',
  },
} satisfies Story;

// args must be inserted after the spread, otherwise the spread's args always win
export const SpreadOnly = {
  ...Primary,
} satisfies Story;

export const SpreadWithRender = {
  ...Primary,
  render: (args) => <MyComponent {...args} />,
} satisfies Story;

export const SpreadPlainObject = {
  ...Primary,
};
