import { Meta, StoryObj } from '@storybook/angular';

import { DocPipe } from './doc-pipe.pipe';

const meta: Meta<DocPipe> = {
  component: DocPipe,
};

export default meta;

type Story = StoryObj<DocPipe>;

export const Basic: Story = {
  render: () => ({
    moduleMetadata: {
      declarations: [DocPipe],
    },
    template: `<div><h1>{{ 'DocPipe' | docPipe }}</h1></div>`,
  }),
};
