import type { Meta } from '@storybook/react';

import { component as Button } from './input';

const meta = {
  title: 'stories/renderers/react/docgen/ts-react-default-exports',
  component: Button,
  tags: ['autodocs'],
  parameters: {
    chromatic: { disableSnapshot: true },
  },
} satisfies Meta<typeof Button>;

export default meta;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Default: any = {};
