import type { Meta, StoryObj } from '@storybook/vue3';

import InheritAttrsPanel from './InheritAttrsPanel.vue';

const meta = {
  component: InheritAttrsPanel,
  title: 'Forms/template-inherit-attrs',
} satisfies Meta<typeof InheritAttrsPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

// `inheritAttrs` only tunes runtime attribute fallthrough, so it must not cost the snippet.
export const Primary: Story = {
  args: {
    label: 'Panel',
  },
  render: (args) => ({
    inheritAttrs: false,
    components: { InheritAttrsPanel },
    setup() {
      return { args };
    },
    template: '<InheritAttrsPanel :label="args.label" />',
  }),
};
