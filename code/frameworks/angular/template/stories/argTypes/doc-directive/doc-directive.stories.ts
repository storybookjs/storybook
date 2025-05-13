import { Meta, StoryObj } from '@storybook/angular';

import { DocDirective } from './doc-directive.directive';

const meta: Meta<DocDirective> = {
  component: DocDirective,
};

export default meta;

type Story = StoryObj<DocDirective>;

export const Basic: Story = {
  render: () => ({
    moduleMetadata: {
      declarations: [DocDirective],
    },
    template: '<div docDirective [hasGrayBackground]="true"><h1>DocDirective</h1></div>',
  }),
};
