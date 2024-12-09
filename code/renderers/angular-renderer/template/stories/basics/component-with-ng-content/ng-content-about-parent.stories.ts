import { Component, Input } from '@angular/core';
import { componentWrapperDecorator, Meta, StoryObj } from '@storybook/angular';

@Component({
  standalone: false,
  selector: 'sb-button',
  template: `<button [style.background-color]="color"><ng-content></ng-content></button>`,
  styles: [
    `
      button {
        padding: 4px;
      }
    `,
  ],
})
class SbButtonComponent {
  @Input()
  color = '#5eadf5';
}

const meta: Meta<SbButtonComponent> = {
  // title: 'Basics / Component / With ng-content / Button with different contents',
  // Implicitly declares the component to Angular
  // This will be the component described by the addon docs
  component: SbButtonComponent,
  decorators: [
    // Wrap all stories with this template
    componentWrapperDecorator(
      (story) => `<sb-button [color]="propsColor">${story}</sb-button>`,

      ({ args }) => ({ propsColor: args['color'] })
    ),
  ],
  argTypes: {
    color: { control: 'color' },
  },
} as Meta;

export default meta;

type Story = StoryObj<SbButtonComponent>;

// By default storybook uses the default export component if no template or component is defined in the story
// So Storybook nests the component twice because it is first added by the componentWrapperDecorator.
export const AlwaysDefineTemplateOrComponent: Story = {};

export const EmptyButton: Story = {
  render: () => ({
    template: '',
  }),
};

export const InH1: Story = {
  render: () => ({
    template: 'My button in h1',
  }),
  decorators: [componentWrapperDecorator((story) => `<h1>${story}</h1>`)],
  name: 'In <h1>',
};
