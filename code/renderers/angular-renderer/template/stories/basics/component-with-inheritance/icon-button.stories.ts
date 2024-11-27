import { Meta, StoryObj } from '@storybook/angular';

import { IconButtonComponent } from './icon-button.component';

const meta: Meta<IconButtonComponent> = {
  // title: 'Basics / Component / With Inheritance',
  component: IconButtonComponent,
};

export default meta;

type Story = StoryObj<IconButtonComponent>;

export const IconButton: Story = {
  args: {
    icon: 'this is icon',
    label: 'this is label',
  },
};
