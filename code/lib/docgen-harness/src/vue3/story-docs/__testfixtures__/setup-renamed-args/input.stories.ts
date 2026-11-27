import type { Meta, StoryObj } from '@storybook/vue3';

import SetupRenamedArgs from './SetupRenamedArgs.vue';

const meta = {
  component: SetupRenamedArgs,
  title: 'Forms/setup-renamed-args',
} satisfies Meta<typeof SetupRenamedArgs>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    label: 'Renamed',
  },
  render: (props) => ({
    components: { SetupRenamedArgs },
    setup() {
      const heading = props.label;
      return { args: props, title: heading };
    },
    template: '<SetupRenamedArgs :label="args.label" :title="title" />',
  }),
};
