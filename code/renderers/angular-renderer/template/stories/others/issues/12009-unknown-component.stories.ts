import { Meta, StoryObj } from '@storybook/angular';

import Button from '../../button.component';

const meta: Meta<Button> = {
  // title: 'Others / Issues / 12009 unknown component',
  component: Button,
};

export default meta;

type Story = StoryObj<Button>;

export const Basic: Story = {
  args: { text: 'Unknown component' },
};
