import React from 'react';
import type { FC } from 'react';

import type { Meta, StoryObj } from '@storybook/react';

export default {
  title: 'MyComponent',
  args: {
    myString: 'foo',
  },
} satisfies Meta<typeof MyComponent>;

type Story = StoryObj<typeof MyComponent>;

// dummy component
const MyComponent: FC<{
  myUndefined: undefined;
  myNull: null;
  myBoolean: boolean;
  myString: string;
  myNumber: number;
  myArray: string[];
  myArrayDeep: string[][];
  myObject: object;
  myFunction: () => void;
}> = (props) => <pre>{JSON.stringify(props)}</pre>;

export const All = {
  args: {
    myArray: ['foo', 'bar'],
    myArrayDeep: [['foo'], ['bar']],
    myBoolean: true,
    myFunction: () => {},
    myNull: null,
    myNumber: 42,
    myObject: {
      foo: 'bar',
    },
    myString: 'foo',
    myUndefined: undefined,
  },
} satisfies Story;

export const None = {
  args: {},
} satisfies Story;
