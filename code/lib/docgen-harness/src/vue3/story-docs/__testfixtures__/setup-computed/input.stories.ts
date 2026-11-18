import { computed } from 'vue';

import type { Meta, StoryObj } from '@storybook/vue3';

import SetupComputed from './SetupComputed.vue';

const meta = {
  component: SetupComputed,
  title: 'Forms/setup-computed',
} satisfies Meta<typeof SetupComputed>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    label: 'Ready',
  },
  render: (args) => ({
    components: { SetupComputed },
    setup() {
      const upper = computed(() => args.label.toUpperCase());
      return { args, upper };
    },
    template: '<SetupComputed :label="args.label" :hint="upper" />',
  }),
};
