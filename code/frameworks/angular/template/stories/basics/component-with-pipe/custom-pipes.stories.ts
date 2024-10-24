import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';

import { CustomPipePipe } from './custom.pipe';
import { WithPipeComponent } from './with-pipe.component';

const meta: Meta<WithPipeComponent> = {
  // title: 'Basics / Component / With Pipes',
  component: WithPipeComponent,
  decorators: [
    moduleMetadata({
      declarations: [CustomPipePipe],
    }),
  ],
  tags: ['!test', '!vitest'],
  parameters: { chromatic: { disable: true } },
};

export default meta;

type Story = StoryObj<WithPipeComponent>;

export const Simple: Story = {
  render: () => ({
    props: {
      field: 'foobar',
    },
  }),
};

export const WithArgsStory: Story = {
  name: 'With args',
  argTypes: {
    field: { control: 'text' },
  },
  args: {
    field: 'Foo Bar',
  },
};
