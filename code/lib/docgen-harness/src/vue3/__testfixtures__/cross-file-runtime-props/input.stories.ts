import type { Meta, StoryObj } from '@storybook/vue3';

import CrossFileRuntimeProps from './CrossFileRuntimeProps.vue';

const meta = {
  title: 'VueFixtures/CrossFileRuntimeProps',
  component: CrossFileRuntimeProps,
} satisfies Meta<typeof CrossFileRuntimeProps>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PropsAsWritten: Story = {
  args: { label: 'Imported', count: 3 },
};
