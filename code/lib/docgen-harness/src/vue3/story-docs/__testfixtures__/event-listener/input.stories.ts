import type { Meta, StoryObj } from '@storybook/vue3';

import EventListenerForm from './EventListenerForm.vue';

const meta = {
  component: EventListenerForm,
  title: 'Forms/event-listener',
} satisfies Meta<typeof EventListenerForm>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    label: 'Send',
    default: () => 'Submit now',
    formatter: (value: string) => value.toUpperCase(),
    onSubmit: (payload: { value: string }) => console.log(payload),
  },
};
