import type { Meta } from '@storybook/svelte-vite';

import TSReferencedPropTypes from './ts-referenced-prop-types.svelte';

const meta = {
  component: TSReferencedPropTypes,
  tags: ['autodocs'],
  render: (args, { argTypes }) => ({
    Component: TSReferencedPropTypes,
    props: { ...args, argTypes },
  }),
} satisfies Meta<typeof TSReferencedPropTypes>;

export default meta;

export const Default = {};
