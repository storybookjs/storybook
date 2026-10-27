import type { Meta, StoryObj } from '@storybook/vue3';

import MetaRenderButton from './MetaRenderButton.vue';

const meta = {
  component: MetaRenderButton,
  title: 'Forms/template-meta-render',
  render: (args) => ({
    components: { MetaRenderButton },
    setup() {
      return { args };
    },
    template: '<section class="preview"><MetaRenderButton v-bind="args" /></section>',
  }),
} satisfies Meta<typeof MetaRenderButton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    label: 'Primary',
    variant: 'primary',
  },
};

export const Secondary: Story = {
  args: {
    label: 'Secondary',
    variant: 'secondary',
  },
};
