import React from 'react';
import type { FC } from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';

export default {
  title: 'MyComponent',
} satisfies Meta<typeof MyComponent>;

type Story = StoryObj<typeof MyComponent>;

// dummy component
const MyComponent: FC<{
  label: string;
  'data-testid': string;
  'aria-label': string;
  123: string;
}> = (props) => <pre>{JSON.stringify(props)}</pre>;

export const NoArgs = {} satisfies Story;

export const QuotedKebabArg = {
  args: {
    'data-testid': 'before',
    label: 'foo',
  },
} satisfies Story;

export const NumericKeyArg = {
  args: {
    123: 'before',
  },
} satisfies Story;
