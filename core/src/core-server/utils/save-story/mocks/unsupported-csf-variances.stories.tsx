import React from 'react';
import type { FC } from 'react';

import type { Meta } from '@storybook/react';

export default {
  title: 'MyComponent',
  args: {
    initial: 'foo',
  },
} satisfies Meta<typeof MyComponent>;

// dummy component
const MyComponent: FC<{ absolute: boolean; bordered: boolean; initial: string }> = (props) => (
  <pre>{JSON.stringify(props)}</pre>
);

export const CSF2 = () => <MyComponent absolute bordered initial="test2" />;

export const CSF2b = CSF2.bind({});
