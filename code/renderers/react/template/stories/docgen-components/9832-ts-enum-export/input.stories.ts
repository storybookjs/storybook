import type { Meta } from '@storybook/react';

import { component } from './input';

const meta = {
  title: 'stories/renderers/react/docgen/ts-enum-export',
  component: component,
  tags: ['autodocs'],
  parameters: {
    chromatic: { disableSnapshot: true },
  },
} satisfies Meta<typeof component>;

export default meta;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Default: any = {};
