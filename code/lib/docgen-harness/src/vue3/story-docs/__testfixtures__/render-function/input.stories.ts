import { h } from 'vue';

import type { Meta, StoryObj } from '@storybook/vue3';

import RenderFunctionButton from './RenderFunctionButton.vue';

const meta = {
  component: RenderFunctionButton,
  title: 'Forms/render-function',
} satisfies Meta<typeof RenderFunctionButton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    label: 'Render',
  },
  render: (args) => h(RenderFunctionButton, args),
};

export const Nested: Story = {
  args: {
    label: 'Confirm',
  },
  render: (args) =>
    h('section', { class: 'toolbar' }, [
      h('h2', 'Actions'),
      h(RenderFunctionButton, args),
      h(RenderFunctionButton, { label: 'Cancel' }),
    ]),
};

export const SpreadOverride: Story = {
  args: {
    label: 'Original',
  },
  render: (args) => h(RenderFunctionButton, { ...args, label: 'Overridden' }),
};

export const ArgsMember: Story = {
  args: {
    label: 'From args',
  },
  render: (args) => h('div', [h(RenderFunctionButton, { label: args.label })]),
};

export const SlotChildren: Story = {
  args: {
    label: 'Confirm',
  },
  render: (args) =>
    h(RenderFunctionButton, args, {
      default: () => h('span', 'Extra'),
      footer: () => h('strong', 'Note'),
    }),
};

export const ArgsOnWrapperAndComponent: Story = {
  args: {
    label: 'Confirm',
  },
  render: (args) => h('section', { class: 'toolbar', ...args }, [h(RenderFunctionButton, args)]),
};
