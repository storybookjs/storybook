import { Meta, StoryObj } from '@storybook/angular';

import { DocInjectableService } from './doc-injectable.service';

const meta: Meta<DocInjectableService> = {
  component: DocInjectableService,
};

export default meta;

type Story = StoryObj<DocInjectableService>;

export const Basic: Story = {
  render: () => ({
    moduleMetadata: {
      providers: [DocInjectableService],
    },
    template: '<div><h1>DocInjectable</h1></div>',
  }),
};
