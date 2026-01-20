import type { Meta } from '@storybook/react';

// @ts-expect-error -- no types for JS file
import { component as Test } from './input';

const meta = {
  title: 'stories/renderers/react/docgen/js-static-prop-types',
  component: Test,
  tags: ['autodocs'],
  parameters: {
    chromatic: { disableSnapshot: true },
  },
} satisfies Meta<typeof Test>;

export default meta;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Default: any = {};
