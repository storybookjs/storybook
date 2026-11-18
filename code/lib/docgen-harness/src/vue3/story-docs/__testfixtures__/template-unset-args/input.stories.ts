import type { Meta, StoryObj } from '@storybook/vue3';

import TemplateUnsetArgs from './TemplateUnsetArgs.vue';

const meta = {
  component: TemplateUnsetArgs,
  title: 'Forms/template-unset-args',
} satisfies Meta<typeof TemplateUnsetArgs>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    id: undefined,
    label: 'Ready',
    hint: 'Optional hint',
    modelValue: undefined,
    onClear: undefined,
  },
  render: (args) => ({
    components: { TemplateUnsetArgs },
    setup() {
      return { args };
    },
    template: `<TemplateUnsetArgs
  :id="args.id"
  :label="args.label"
  :hint="args.hint"
  v-model="args.modelValue"
  @clear="args.onClear"
/>`,
  }),
};
