import type { Meta } from '@storybook/react';

// @ts-expect-error -- no types for JS file
import { component as Credits } from './input';

const meta = {
  title: 'stories/renderers/react/docgen/js-proptypes-shape',
  component: Credits,
  tags: ['autodocs'],
  parameters: {
    chromatic: { disableSnapshot: true },
  },
} satisfies Meta<typeof Credits>;

export default meta;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Default: any = {};
