import type { Meta } from '@storybook/svelte-vite';

import TSInlinePropTypes from './ts-inline-prop-types.svelte';

const meta = {
  component: TSInlinePropTypes,
  tags: ['autodocs'],
  render: (args, { argTypes }) => ({
    Component: TSInlinePropTypes,
    props: { ...args, argTypes },
  }),
} satisfies Meta<typeof TSInlinePropTypes>;

export default meta;

export const Default = {};
