/* eslint-disable @typescript-eslint/no-unused-vars */
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

export const Cast: Story = {
  args: {
    initial: 'bar',
  },
};

export const As = {
  args: {
    initial: 'bar',
  },
} as Story;

export const Satisfies = {
  args: {
    initial: 'bar',
  },
} satisfies Story;

export const None = {
  args: {
    initial: 'bar',
  },
};
