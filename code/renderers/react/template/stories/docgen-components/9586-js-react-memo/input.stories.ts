import type { Meta } from '@storybook/react';

// @ts-expect-error -- no types for JS file
import { component as MemoButton } from './input';

const meta = {
  title: 'stories/renderers/react/docgen/js-react-memo',
  component: MemoButton,
  tags: ['autodocs'],
  parameters: {
    chromatic: { disableSnapshot: true },
  },
} satisfies Meta<typeof MemoButton>;

export default meta;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Default: any = {};
