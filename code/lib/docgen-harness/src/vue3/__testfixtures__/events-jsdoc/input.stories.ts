import type { Meta, StoryObj } from '@storybook/vue3';

import EventsJsdoc from './EventsJsdoc.vue';

const meta = {
  title: 'VueFixtures/EventsJsdoc',
  component: EventsJsdoc,
} satisfies Meta<typeof EventsJsdoc>;

export default meta;

type Story = StoryObj<typeof meta>;

export const WithHandlers: Story = {
  args: {
    label: 'Save',
    onSave: () => {},
    onCancel: () => {},
  },
};
