import { Meta, StoryObj, argsToTemplate } from '@storybook/angular';

import { Template } from './template.component';

const meta: Meta<Template> = {
  component: Template,
};

export default meta;

type Story = StoryObj<Template>;

export const Default: Story = {
  render: (args) => ({
    props: args,
    template: `<app-template ${argsToTemplate(args)}></app-template>`,
  }),
};

export const SetOneInput: Story = {
  ...Default,
  args: {
    label: 'Label Example 1',
  },
};
