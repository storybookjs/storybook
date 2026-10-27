import type { Meta, StoryObj } from '@storybook/vue3';

import ImportedInterfaceProps from './ImportedInterfaceProps.vue';

const meta = {
  title: 'VueFixtures/ImportedInterfaceProps',
  component: ImportedInterfaceProps,
} satisfies Meta<typeof ImportedInterfaceProps>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PropsAsWritten: Story = {
  args: { label: 'Imported', count: 2 },
};
