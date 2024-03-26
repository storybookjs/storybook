import type { Meta, StoryObj } from '@storybook/react';
import { Title } from './Title';
import * as DefaultButtonStories from '../examples/Button.stories';

const meta: Meta<typeof Title> = {
  component: Title,
  title: 'Blocks/Title',
  parameters: {
    controls: {
      include: [],
      hideNoControlsWarning: true,
    },
    // workaround for https://github.com/storybookjs/storybook/issues/20505
    docs: { source: { type: 'code' } },
    attached: false,
    docsStyles: true,
  },
};
export default meta;

type Story = StoryObj<typeof meta>;

export const OfCSFFileInComponentTitle: Story = {
  name: 'Of CSF File with title',
  args: {
    of: DefaultButtonStories,
  },
  parameters: { relativeCsfPaths: ['../examples/Button.stories'] },
};

export const OfMetaInComponentTitle: Story = {
  name: 'Of meta with title',
  args: {
    of: DefaultButtonStories,
  },
  parameters: { relativeCsfPaths: ['../examples/Button.stories'] },
};

export const OfStringMetaAttached: Story = {
  name: 'Of attached "meta"',
  args: {
    of: 'meta',
  },
  parameters: { relativeCsfPaths: ['../examples/Button.stories'], attached: true },
};

export const Children: Story = {
  args: {
    children: 'Custom title',
  },
};

export const DefaultAttached: Story = {
  args: {},
  parameters: { relativeCsfPaths: ['../examples/Button.stories'], attached: true },
};
