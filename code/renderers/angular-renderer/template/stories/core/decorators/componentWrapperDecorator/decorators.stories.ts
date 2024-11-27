// your-component.stories.ts
import {
  Args,
  Meta,
  StoryObj,
  componentWrapperDecorator,
  moduleMetadata,
} from '@storybook/angular';

import ChildComponent from './child.component';
import ParentComponent from './parent.component';

const meta: Meta<ChildComponent> = {
  // title: 'Core / Decorators / ComponentWrapperDecorator',
  component: ChildComponent,
  decorators: [
    componentWrapperDecorator(
      (story) => `Grandparent<br><div style="margin: 3em; border:solid;">${story}</div>`
    ),
  ],
  args: { childText: 'Child text', childPrivateText: 'Child private text' },
  argTypes: { onClickChild: { action: 'onClickChild' } },
};

export default meta;

type Story = StoryObj<ChildComponent>;

export const WithTemplate: Story = {
  render: (args: Args) => ({
    template: `Child Template`,
    props: args,
  }),
};

export const WithComponent: Story = {};

export const WithLegacyComponent: Story = {
  render: (args: Args) => ({
    component: ChildComponent,
    props: args,
  }),
};

export const WithComponentWrapperDecorator: Story = {
  render: (args: Args) => ({
    component: ChildComponent,
    props: args,
  }),
  decorators: [
    moduleMetadata({ declarations: [ParentComponent] }),
    componentWrapperDecorator(ParentComponent),
  ],
};

export const WithComponentWrapperDecoratorAndProps: Story = {
  render: (args: Args) => ({
    component: ChildComponent,
    props: {
      ...args,
    },
  }),
  decorators: [
    moduleMetadata({ declarations: [ParentComponent] }),
    componentWrapperDecorator(ParentComponent, {
      parentText: 'Parent text',
      onClickParent: () => {
        console.log('onClickParent');
      },
    }),
  ],
};

export const WithComponentWrapperDecoratorAndArgs: StoryObj<{
  parentText: string;
  onClickParent: () => void;
}> = {
  render: (args: Args) => ({
    component: ChildComponent,
    props: {
      ...args,
    },
  }),
  argTypes: {
    parentText: { control: { type: 'text' } },
    onClickParent: { action: 'onClickParent' },
  },
  decorators: [
    moduleMetadata({ declarations: [ParentComponent] }),
    componentWrapperDecorator(ParentComponent, ({ args }) => ({
      parentText: args.parentText,
      onClickParent: args.onClickParent,
    })),
  ],
};

export const WithCustomDecorator = (args: Args) => ({
  template: `Child Template`,
  props: {
    ...args,
  },
});
WithCustomDecorator.decorators = [
  (storyFunc) => {
    const story = storyFunc();

    return {
      ...story,
      template: `Custom Decorator <div style="margin: 3em">${story.template}</div>`,
    };
  },
] as Story['decorators'];
