import type { Meta, StoryObj } from '@storybook/vue3';

import CrossFilePropsSpread from './CrossFilePropsSpread.vue';

const meta = {
  title: 'VueFixtures/CrossFilePropsSpread',
  component: CrossFilePropsSpread,
} satisfies Meta<typeof CrossFilePropsSpread>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PropsAsWritten: Story = {
  args: { value: 'hello', label: 'Text label', optional: false },
};
