import type { Meta } from '@storybook/react';

import { component as Avatar } from './input';

const meta = {
  title: 'stories/renderers/react/docgen/ts-union',
  component: Avatar,
  tags: ['autodocs'],
  parameters: {
    chromatic: { disableSnapshot: true },
  },
} satisfies Meta<typeof Avatar>;

export default meta;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Default: any = {};
