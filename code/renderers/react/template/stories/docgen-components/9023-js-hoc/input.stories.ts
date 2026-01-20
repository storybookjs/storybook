import type { Meta } from '@storybook/react';

// @ts-expect-error -- no types for JS file
import { component as StyledAlert } from './input';

const meta = {
  title: 'stories/renderers/react/docgen/js-hoc',
  component: StyledAlert,
  tags: ['autodocs'],
  parameters: {
    chromatic: { disableSnapshot: true },
  },
} satisfies Meta<typeof StyledAlert>;

export default meta;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Default: any = {};
