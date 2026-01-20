import type { Meta } from '@storybook/react';

import { component as A } from './input';

const meta = {
  title: 'stories/renderers/react/docgen/ts-multiple-components',
  component: A,
  tags: ['autodocs'],
  parameters: {
    chromatic: { disableSnapshot: true },
  },
} satisfies Meta<typeof A>;

export default meta;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Default: any = {};
