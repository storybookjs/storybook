import type { Meta } from '@storybook/react';

import { component as Hello } from './input';

const meta = {
  title: 'stories/renderers/react/docgen/ts-default-values',
  component: Hello,
  tags: ['autodocs'],
  parameters: {
    chromatic: { disableSnapshot: true },
  },
} satisfies Meta<typeof Hello>;

export default meta;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Default: any = {};
