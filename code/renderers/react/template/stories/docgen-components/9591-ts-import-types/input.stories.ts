import type { Meta } from '@storybook/react';

import { component as Other } from './input';

const meta = {
  title: 'stories/renderers/react/docgen/ts-import-types',
  component: Other,
  tags: ['autodocs'],
  parameters: {
    chromatic: { disableSnapshot: true },
  },
} satisfies Meta<typeof Other>;

export default meta;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Default: any = {};
