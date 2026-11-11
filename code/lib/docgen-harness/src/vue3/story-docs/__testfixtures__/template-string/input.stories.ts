import type { Meta, StoryObj } from '@storybook/vue3';

import TemplateStringBadge from './TemplateStringBadge.vue';
import TemplateStringButton from './TemplateStringButton.vue';

const meta = {
  component: TemplateStringButton,
  title: 'Forms/template-string',
} satisfies Meta<typeof TemplateStringButton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    label: 'Template',
  },
  render: (args) => ({
    components: { TemplateStringBadge, TemplateStringButton },
    setup() {
      return { args };
    },
    template:
      '<div class="wrap"><TemplateStringBadge text="New" /><TemplateStringButton v-bind="args" /></div>',
  }),
};

export const AssignedArgs: Story = {
  render: (args) => ({
    components: { TemplateStringButton },
    setup() {
      return { args };
    },
    template: '<TemplateStringButton v-bind="args" />',
  }),
};

AssignedArgs.args = {
  label: 'Assigned template',
};
