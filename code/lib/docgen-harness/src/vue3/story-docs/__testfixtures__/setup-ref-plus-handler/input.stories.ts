import { ref } from 'vue';

import type { Meta, StoryObj } from '@storybook/vue3';

import SetupRefPlusHandler from './SetupRefPlusHandler.vue';

const meta = {
  component: SetupRefPlusHandler,
  title: 'Forms/setup-ref-plus-handler',
} satisfies Meta<typeof SetupRefPlusHandler>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    label: 'Count',
  },
  render: (args) => ({
    components: { SetupRefPlusHandler },
    setup() {
      const count = ref(0);
      const increment = () => {
        count.value += 1;
      };
      return { args, count, increment };
    },
    template: '<SetupRefPlusHandler :label="args.label" :count="count" @increment="increment" />',
  }),
};
