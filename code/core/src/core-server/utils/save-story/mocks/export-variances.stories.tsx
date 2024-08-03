import React from 'react';
import type { FC } from 'react';
import type { Meta, StoryObj } from '@storybook/react';

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

export const DirectExport: Story = {
  args: {
    initial: 'bar',
  },
};

const BlockExport: Story = {
  args: {
    initial: 'bar',
  },
};

const NotYetRenamedExport: Story = {
  args: {
    initial: 'bar',
  },
};

export { BlockExport, NotYetRenamedExport as RenamedExport };
