import type { Meta } from '@storybook/react';

import { component as FooComponent } from './input';

const meta = {
  title: 'stories/renderers/react/docgen/ts-imported-types',
  component: FooComponent,
  tags: ['autodocs'],
  parameters: {
    chromatic: { disableSnapshot: true },
  },
} satisfies Meta<typeof FooComponent>;

export default meta;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Default: any = {};
