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

export const Empty = {} satisfies Story;

export const EmptyWithComment = {
  // this is a useless comment, to test that it is preserved
} satisfies Story;

export const OnlyArgs = {
  args: {
    absolute: true,
  },
} satisfies Story;

export const RenderNoArgs = {
  render: (args) => <MyComponent {...args} />,
} satisfies Story;

export const RenderArgs = {
  args: {
    absolute: true,
  },
  render: (args) => <MyComponent {...args} />,
} satisfies Story;

export const RenderExistingArgs = {
  args: {
    absolute: true,
    bordered: true,
    initial: 'test2',
  },
  render: (args) => <MyComponent {...args} />,
} satisfies Story;

// The order of both the properties of the story and the order or args should be preserved
export const OrderedArgs = {
  args: {
    bordered: true,
    initial: 'test2',
    absolute: true,
  },
  render: (args) => <MyComponent {...args} />,
} satisfies Story;

// The order of both the properties of the story and the order or args should be preserved
export const HasPlayFunction = {
  args: {
    bordered: true,
    initial: 'test2',
    absolute: true,
  },
  play: async ({ canvasElement }) => {
    console.log('play');

    canvasElement.style.backgroundColor = 'red';
  },
} satisfies Story;
