import React from 'react';
import type { FC } from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';

export default {
  title: 'MyComponent',
} satisfies Meta<typeof MyComponent>;

type Story = StoryObj<typeof MyComponent>;

// dummy component
const MyComponent: FC<{ name: string; primary: boolean }> = (props) => (
  <pre>{JSON.stringify(props)}</pre>
);

export const WithName = {
  name: 'Custom Display Name',
  args: {
    primary: true,
  },
} satisfies Story;

export const WithNestedName = {
  name: 'Another Display Name',
  parameters: {
    design: {
      name: 'nested name that must be preserved',
    },
  },
  argTypes: {
    name: {
      control: 'text',
    },
  },
} satisfies Story;

export const WithOnlyName = {
  name: 'Only A Name',
} satisfies Story;

export const WithNameAs = {
  name: 'As Display Name',
} as Story;
