import type { Meta, StoryObj } from '@storybook/vue3';

import PropsGeneric from './PropsGeneric.vue';

const meta = {
  title: 'VueFixtures/PropsGeneric',
  // @ts-expect-error - a generic SFC (generic="T") is a component factory Meta cannot model
  // (TS2559); when this directive turns unused the friction is fixed - restore normal typing.
  component: PropsGeneric,
} satisfies Meta<typeof PropsGeneric>;

export default meta;

// Args typed explicitly: deriving StoryObj<typeof meta> from a generic component is unreliable.
type Story = StoryObj<{ items: string[]; selected?: string }>;

export const PropsAsWritten: Story = {
  args: { items: ['alpha', 'beta'], selected: 'alpha' },
};
