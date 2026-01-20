import type { Meta } from '@storybook/react';

import { component as iconButton } from './input';

const meta = {
  title: 'stories/renderers/react/docgen/ts-camel-case',
  component: iconButton,
  tags: ['autodocs'],
  parameters: {
    chromatic: { disableSnapshot: true },
  },
} satisfies Meta<typeof iconButton>;

export default meta;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Default: any = {};
