import type { Meta, StoryObj } from '@storybook/vue3';

import CrossFileUnionAlias from './CrossFileUnionAlias.vue';

const meta = {
  title: 'VueFixtures/CrossFileUnionAlias',
  component: CrossFileUnionAlias,
} satisfies Meta<typeof CrossFileUnionAlias>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PropsAsWritten: Story = {
  args: { variant: 'danger', size: 'small' },
};
