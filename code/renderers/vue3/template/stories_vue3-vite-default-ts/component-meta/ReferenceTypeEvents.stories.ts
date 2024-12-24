import type { Meta, StoryObj } from '@storybook/vue3';

import Component from './reference-type-events/component.vue';

const meta = {
  component: Component,
  tags: ['autodocs'],
} satisfies Meta<typeof Component>;

type Story = StoryObj<typeof meta>;
export default meta;

export const ReferenceTypeEvents: Story = {};
