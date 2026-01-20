import type { Meta } from '@storybook/react';

import { component as Radio } from './input';

const meta = {
  title: 'stories/renderers/react/docgen/ts-extend-props',
  component: Radio,
  tags: ['autodocs'],
  parameters: {
    chromatic: { disableSnapshot: true },
  },
} satisfies Meta<typeof Radio>;

export default meta;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Default: any = {};
