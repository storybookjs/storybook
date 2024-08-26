import { Component } from '@angular/core';

import { Meta, StoryObj } from '@storybook/angular';

@Component({
  selector: 'storybook-with-ng-content',
  template: `Content value:
<div style="color: #1e88e5"><ng-content></ng-content></div>`,
})
class WithNgContentComponent {}

const meta: Meta<WithNgContentComponent> = {
  // title: 'Basics / Component / With ng-content / Simple',
  component: WithNgContentComponent,
} as Meta;

export default meta;

type Story = StoryObj<WithNgContentComponent & { content: string }>;

export const OnlyComponent: Story = {};

export const Default: Story = {
  render: () => ({
    template: `<storybook-with-ng-content><h1>This is rendered in ng-content</h1></storybook-with-ng-content>`,
  }),
};

export const WithDynamicContentAndArgs: Story = {
  render: (args) => ({
    template: `<storybook-with-ng-content><h1>${args['content']}</h1></storybook-with-ng-content>`,
  }),
  args: { content: 'Default content' },
  argTypes: {
    content: { control: 'text' },
  },
};
