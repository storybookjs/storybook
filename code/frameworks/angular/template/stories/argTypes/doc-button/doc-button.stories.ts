import { Meta, StoryObj, argsToTemplate } from '@storybook/angular';

import { DocButtonComponent } from './doc-button.component';

const meta: Meta<DocButtonComponent<any>> = {
  component: DocButtonComponent,
};

export default meta;

type Story = StoryObj<DocButtonComponent<any>>;

export const Basic: Story = {
  args: { label: 'Args test', isDisabled: false },
  argTypes: {
    theDefaultValue: {
      table: {
        defaultValue: { summary: 'Basic default value' },
      },
    },
  },
};

export const WithTemplate: Story = {
  args: { label: 'Template test', appearance: 'primary' },
  render: (args) => ({
    props: args,
    template: `<my-button ${argsToTemplate(args)}></my-button>`,
  }),
};
