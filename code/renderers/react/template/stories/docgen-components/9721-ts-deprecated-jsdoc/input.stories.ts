import type { Meta } from '@storybook/react';

import { component as Foo } from './input';

const meta = {
  title: 'stories/renderers/react/docgen/ts-deprecated-jsdoc',
  component: Foo,
  tags: ['autodocs'],
  parameters: {
    chromatic: { disableSnapshot: true },
  },
} satisfies Meta<typeof Foo>;

export default meta;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Default: any = {};
