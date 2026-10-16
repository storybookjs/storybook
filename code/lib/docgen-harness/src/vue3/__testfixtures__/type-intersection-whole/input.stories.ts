import type { Meta, StoryObj } from '@storybook/vue3';

import TypeIntersectionWhole from './TypeIntersectionWhole.vue';

const meta = {
  title: 'VueFixtures/TypeIntersectionWhole',
  component: TypeIntersectionWhole,
} satisfies Meta<typeof TypeIntersectionWhole>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PropsAsWritten: Story = {
  args: { id: 'save-button', size: 'medium' },
};
