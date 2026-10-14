import type { Meta, StoryObj } from '@storybook/vue3';

import TemplateSharedValues from './TemplateSharedValues.vue';

const meta = {
  component: TemplateSharedValues,
  title: 'Forms/template-shared-values',
} satisfies Meta<typeof TemplateSharedValues>;

export default meta;

type Story = StoryObj<typeof meta>;

export const ForEachItem: Story = {
  args: {
    items: [{ id: 1 }, { id: 2 }],
  },
  render: (args) => ({
    setup: () => ({ args }),
    template: `<ul><li v-for="item in args.items" :key="item.id">{{ item === args.items[0] ? 'first' : 'other' }}</li></ul>`,
  }),
};

export const SetupMutation: Story = {
  args: {
    items: ['a'],
  },
  render: (args) => ({
    components: { TemplateSharedValues },
    setup() {
      args.items?.push('b');
      return { args };
    },
    template: '<TemplateSharedValues :items="args.items" />',
  }),
};

export const SpreadWithClass: Story = {
  args: {
    label: 'Go',
  },
  render: (args) => ({
    components: { TemplateSharedValues },
    setup: () => ({ args }),
    template: '<TemplateSharedValues v-bind="args" class="own" style="color: red" />',
  }),
};
