import type { Meta } from '@storybook/react';

import { component as TypeScriptProps } from './input';

const meta = {
  title: 'stories/renderers/react/docgen/ts-types',
  component: TypeScriptProps,
  tags: ['autodocs'],
  parameters: {
    chromatic: { disableSnapshot: true },
  },
} satisfies Meta<typeof TypeScriptProps>;

export default meta;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Default: any = {};
