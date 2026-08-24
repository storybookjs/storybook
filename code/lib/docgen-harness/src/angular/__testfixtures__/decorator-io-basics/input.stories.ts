import type { Meta, StoryObj } from '../../csf-types.ts';

import { DecoratorIoBasicsComponent } from './decorator-io-basics.component.ts';

const meta = {
  title: 'AngularFixtures/DecoratorIoBasics',
  component: DecoratorIoBasicsComponent,
} satisfies Meta<DecoratorIoBasicsComponent>;

export default meta;

type Story = StoryObj<DecoratorIoBasicsComponent>;

export const PropsAsWritten: Story = {
  args: { label: 'Save', count: 3 },
};

export const EventHandlerArg: Story = {
  args: {
    label: 'Save',
    clicked: () => {},
  },
};

export const ObjectAndArrayArgs: Story = {
  args: {
    label: 'Save',
    data: { id: 7, tags: ['a', 'b'], nested: { deep: true } },
  },
};

export const ExplicitUndefinedArg: Story = {
  args: { label: undefined, count: 1 },
};
