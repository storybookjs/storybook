import type { Meta } from '@storybook/react';

import { component as EmpireAlert } from './input';

const meta = {
  title: 'stories/renderers/react/docgen/ts-display-name',
  component: EmpireAlert,
  tags: ['autodocs'],
  parameters: {
    chromatic: { disableSnapshot: true },
  },
} satisfies Meta<typeof EmpireAlert>;

export default meta;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Default: any = {};
