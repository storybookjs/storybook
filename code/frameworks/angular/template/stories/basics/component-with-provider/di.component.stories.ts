import { Args, Meta, StoryObj } from '@storybook/angular';

import { DiComponent } from './di.component';

const meta: Meta<DiComponent> = {
  // title: 'Basics / Component / With Provider',
  component: DiComponent,
};

export default meta;

type Story = StoryObj<DiComponent>;

export const InputsAndInjectDependencies: Story = {
  render: () => ({
    props: {
      title: 'Component dependencies',
    },
  }),
  name: 'inputs and inject dependencies',
};

export const InputsAndInjectDependenciesWithArgs: Story = {
  name: 'inputs and inject dependencies with args',
  argTypes: {
    title: { control: 'text' },
  },
  args: {
    title: 'Component dependencies',
  },
};
