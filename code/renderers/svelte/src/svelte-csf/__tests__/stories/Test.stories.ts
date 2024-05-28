import type { Meta, StoryObj } from '@storybook/svelte';

import Test from './Test.svelte';

/**
 * Test for  CSF
 */
const meta = {
  title: 'Test/Regular CSF',
  component: Test,
  argTypes: {
    csf: { table: { disable: true } },
    system: { table: { disable: true } },
  },
  tags: ['autodocs', '!dev'],
} satisfies Meta<Test>;

export default meta;

type Story = StoryObj<Test>;

export const Default: Story = {
  args: { csf: 'regular' },
};
