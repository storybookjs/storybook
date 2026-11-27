import type { Meta, StoryObj } from '@storybook/vue3';

import TemplateArgsExpression from './TemplateArgsExpression.vue';

const availableStatus = { state: 'available', version: '1.2.3' };
const release = { tag: 'v1.2.3', name: 'Release 1.2.3' };

const meta = {
  component: TemplateArgsExpression,
  title: 'Forms/template-args-expression',
  args: {
    status: availableStatus,
    release,
    updateProgressInfo: null,
    isCollapsed: false,
  },
  render: (args) => ({
    components: { TemplateArgsExpression },
    setup: () => ({ args }),
    template: `
      <div
        :style="{
          '--sidebar-width-collapsed': '52px',
          width: args.isCollapsed ? '52px' : '176px',
          overflow: 'hidden'
        }"
      >
        <TemplateArgsExpression v-bind="args" />
      </div>
    `,
  }),
} satisfies Meta<typeof TemplateArgsExpression>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = {};

export const Collapsed: Story = {
  args: { isCollapsed: true },
};
