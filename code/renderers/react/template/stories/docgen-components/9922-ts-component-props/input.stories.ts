import type { Meta } from '@storybook/react';

import { component as WrappedButton } from './input';

const meta = {
  title: 'stories/renderers/react/docgen/ts-component-props',
  component: WrappedButton,
  tags: ['autodocs'],
  parameters: {
    chromatic: { disableSnapshot: true },
  },
} satisfies Meta<typeof WrappedButton>;

export default meta;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Default: any = {};
