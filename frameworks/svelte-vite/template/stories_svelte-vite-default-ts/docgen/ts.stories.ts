import type { Meta } from '@storybook/svelte-vite';

import TS from './ts.svelte';

const meta = {
  component: TS,
  tags: ['autodocs'],
  render: (args, { argTypes }) => ({
    Component: TS,
    props: { ...args, argTypes },
  }),
} satisfies Meta<typeof TS>;

export default meta;

export const Default = {};
