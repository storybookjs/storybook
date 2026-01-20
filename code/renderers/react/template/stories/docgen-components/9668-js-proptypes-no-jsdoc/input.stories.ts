import type { Meta } from '@storybook/react';

// @ts-expect-error -- no types for JS file
import { component as CCTable } from './input';

const meta = {
  title: 'stories/renderers/react/docgen/js-proptypes-no-jsdoc',
  component: CCTable,
  tags: ['autodocs'],
  parameters: {
    chromatic: { disableSnapshot: true },
  },
} satisfies Meta<typeof CCTable>;

export default meta;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Default: any = {};
