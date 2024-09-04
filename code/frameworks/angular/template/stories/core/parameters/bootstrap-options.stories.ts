import { Meta, StoryObj } from '@storybook/angular';
import { Component } from '@angular/core';

@Component({
  selector: 'component-with-whitespace',
  preserveWhitespaces: true,
  template: ` <div>
  <p>Some content</p>
</div>`,
})
class ComponentWithWhitespace {}

const meta: Meta<ComponentWithWhitespace> = {
  // title: 'Core / Parameters / With Bootstrap Options',
  component: ComponentWithWhitespace,
};

export default meta;

type Story = StoryObj<ComponentWithWhitespace>;

export const WithPreserveWhitespaces: Story = {};
