import { action } from '@storybook/addon-actions';
import { linkTo } from '@storybook/addon-links';

import Label from './label.component';

export default {
  title: 'issues/11613',
  component: Label,
  argTypes: {
    text: { control: 'text' },
    bgColor: { control: { type: 'select', options: ['#ff0', '#F00', '#0F0'] } },
  },
};

const Template = (args: Label) => ({
  component: Label,
  props: args,
});

export const LabelText = Template.bind({});
LabelText.args = {
  text: 'Default Label',
};
