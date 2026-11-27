import type { Meta, StoryObj } from '@storybook/vue3';

import TemplateVModelExpansion from './TemplateVModelExpansion.vue';

const meta = {
  component: TemplateVModelExpansion,
  title: 'Forms/template-v-model-expansion',
} satisfies Meta<typeof TemplateVModelExpansion>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    modelValue: 'Draft text',
    label: 'Message',
  },
  render: (args) => ({
    components: { TemplateVModelExpansion },
    setup: () => ({ args }),
    template: '<TemplateVModelExpansion v-bind="args" />',
  }),
};
