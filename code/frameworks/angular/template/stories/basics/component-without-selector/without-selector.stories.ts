import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';

import { WITHOUT_SELECTOR_DATA, WithoutSelectorComponent } from './without-selector.component';

const meta: Meta<WithoutSelectorComponent> = {
  // title: 'Basics / Component / without selector',
  component: WithoutSelectorComponent,
  decorators: [
    moduleMetadata({
      entryComponents: [WithoutSelectorComponent],
    }),
  ],
} as Meta;

export default meta;

type Story = StoryObj<WithoutSelectorComponent>;

export const SimpleComponent: Story = {};

// Live changing of args by controls does not work for now. When changing args storybook does not fully
// reload and therefore does not take into account the change of provider.
export const WithInjectionTokenAndArgs: StoryObj = {
  render: (args) => ({
    props: args,
    moduleMetadata: {
      providers: [
        { provide: WITHOUT_SELECTOR_DATA, useValue: { color: args['color'], name: args['name'] } },
      ],
    },
  }),
  argTypes: {
    name: { control: 'text' },
    color: { control: 'color' },
  },
  args: { name: 'Color', color: 'red' },
};
