import { Meta, StoryObj } from '@storybook/angular';

import { OnPushBoxComponent } from './on-push-box.component';

const meta: Meta<OnPushBoxComponent> = {
  // title: 'Basics / Component / With OnPush strategy',
  component: OnPushBoxComponent,
  argTypes: {
    word: { control: 'text' },
    bgColor: { control: 'color' },
  },
  args: {
    word: 'The text',
    bgColor: '#FFF000',
  },
};

export default meta;

type Story = StoryObj<OnPushBoxComponent>;

export const ClassSpecifiedComponentWithOnPushAndArgs: Story = {
  name: 'Class-specified component with OnPush and Args',
};
