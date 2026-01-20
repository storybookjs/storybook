import type { Meta } from '@storybook/react';

import { component as Component } from './input';

const meta = {
  title: 'stories/renderers/react/docgen/ts-type-props',
  component: Component,
  tags: ['autodocs'],
  parameters: {
    chromatic: { disableSnapshot: true },
  },
} satisfies Meta<typeof Component>;

export default meta;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Default: any = {};
