import type { Meta, StoryObj } from '@storybook/vue3';

import TemplateUnsupportedPanel from './TemplateUnsupportedPanel.vue';

const meta = {
  component: TemplateUnsupportedPanel,
  title: 'Forms/template-unsupported',
} satisfies Meta<typeof TemplateUnsupportedPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    hidden: true,
    label: 'Hidden panel',
  },
  render: (args) => ({
    components: { TemplateUnsupportedPanel },
    setup() {
      return { args };
    },
    template: '<TemplateUnsupportedPanel v-bind="{ ...args }" />',
  }),
};
