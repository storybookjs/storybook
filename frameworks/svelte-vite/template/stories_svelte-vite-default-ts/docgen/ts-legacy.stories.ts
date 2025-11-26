import type { Meta } from '@storybook/svelte-vite';

import TSLegacy from './ts-legacy.svelte';

const meta = {
  component: TSLegacy,
  tags: ['autodocs'],
  render: (args, { argTypes }) => ({
    Component: TSLegacy,
    props: { ...args, argTypes } as any,
  }),
} satisfies Meta<typeof TSLegacy>;

export default meta;

export const Default = {};
