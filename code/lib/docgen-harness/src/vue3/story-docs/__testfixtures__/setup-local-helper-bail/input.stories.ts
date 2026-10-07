import type { Meta, StoryObj } from '@storybook/vue3';

import SetupLocalHelperBail from './SetupLocalHelperBail.vue';

const meta = {
  component: SetupLocalHelperBail,
  title: 'Forms/setup-local-helper-bail',
} satisfies Meta<typeof SetupLocalHelperBail>;

export default meta;

type Story = StoryObj<typeof meta>;

const formatBadge = (value: string) => value.toUpperCase();

export const Primary: Story = {
  args: {
    label: 'Badge',
  },
  render: (args) => ({
    components: { SetupLocalHelperBail },
    setup() {
      const badge = formatBadge('new');
      return { args, badge };
    },
    template: '<SetupLocalHelperBail :label="args.label" :badge="badge" />',
  }),
};
