import type { Meta } from '@storybook/react';

// @ts-expect-error -- no types for JS file
import { component as Alert } from './input';

const meta = {
  title: 'stories/renderers/react/docgen/js-prop-types-oneof',
  component: Alert,
  tags: ['autodocs'],
  parameters: {
    chromatic: { disableSnapshot: true },
  },
} satisfies Meta<typeof Alert>;

export default meta;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Default: any = {};
