import { fn } from 'storybook/test';

import type { Meta, StoryObj } from '@storybook/svelte';

import Callbacks from './Callbacks.svelte';

const meta = {
  title: 'SvelteFixtures/CallbacksPlain',
  component: Callbacks,
} satisfies Meta<typeof Callbacks>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { onclick: fn(), onchange: fn(), format: (n: number) => `#${n}` },
};
