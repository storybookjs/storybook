import type { Meta } from '@storybook/react';

import { component as Text } from './input';

const meta = {
  title: 'stories/renderers/react/docgen/ts-react-fc-generics',
  component: Text,
  tags: ['autodocs'],
  parameters: {
    chromatic: { disableSnapshot: true },
  },
} satisfies Meta<typeof Text>;

export default meta;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Default: any = {};
