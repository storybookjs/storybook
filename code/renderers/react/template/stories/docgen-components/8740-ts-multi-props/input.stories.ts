import type { Meta } from '@storybook/react';

import { component as Header } from './input';

const meta = {
  title: 'stories/renderers/react/docgen/ts-multi-props',
  component: Header,
  tags: ['autodocs'],
  parameters: {
    chromatic: { disableSnapshot: true },
  },
} satisfies Meta<typeof Header>;

export default meta;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Default: any = {};
