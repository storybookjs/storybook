import type { Meta } from '@storybook/react';

// @ts-expect-error -- no types for JS file
import { component as PropsWriter } from './input';

const meta = {
  title: 'stories/renderers/react/docgen/js-re-exported-component',
  component: PropsWriter,
  tags: ['autodocs'],
  parameters: {
    chromatic: { disableSnapshot: true },
  },
} satisfies Meta<typeof PropsWriter>;

export default meta;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Default: any = {};
