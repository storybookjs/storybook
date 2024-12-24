import { Meta, StoryObj } from '@storybook/angular';

import { BaseButtonComponent } from './base-button.component';

const meta: Meta<BaseButtonComponent> = {
  // title: 'Basics / Component / With Inheritance',
  component: BaseButtonComponent,
};

export default meta;

export const BaseButton: StoryObj<BaseButtonComponent> = {
  args: {
    label: 'this is label',
  },
};
