import type { Meta, StoryObj } from '@storybook/vue3';

import Component from './unicode-defaults/destructured-define-props.vue';

const meta = {
  component: Component,
  tags: ['autodocs'],
  title: 'stories/renderers/vue3_vue3-vite-default-ts/component-meta/unicode-define-props',
} satisfies Meta<typeof Component>;

type Story = StoryObj<typeof meta>;
export default meta;

export const Default: Story = {};
