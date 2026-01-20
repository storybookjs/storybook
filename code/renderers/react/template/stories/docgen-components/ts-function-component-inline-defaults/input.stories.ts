import type { Meta } from '@storybook/react';

import { component as PropsWriter } from './input';

const meta = {
  title: 'stories/renderers/react/docgen/ts-function-component-inline-defaults',
  component: PropsWriter,
  tags: ['autodocs'],
  parameters: {
    chromatic: { disableSnapshot: true },
  },
} satisfies Meta<typeof PropsWriter>;

export default meta;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Default: any = {};
