import type { Meta, StoryObj } from '@storybook/react';
import { Stories } from './Stories';
import * as DefaultButtonStories from '../examples/Button.stories';
import * as ParameterStories from '../examples/StoriesParameters.stories';
import * as ButtonSomeAutodocs from '../examples/ButtonSomeAutodocs.stories';
import * as ButtonNoAutodocs from '../examples/ButtonNoAutodocs.stories';

const meta: Meta<typeof Stories> = {
  component: Stories,
  parameters: {
    relativeCsfPaths: [
      '../examples/Button.stories',
      '../examples/StoriesParameters.stories',
      '../examples/ButtonSomeAutodocs.stories',
      '../examples/ButtonNoAutodocs.stories',
    ],
    // workaround for https://github.com/storybookjs/storybook/issues/20505
    docs: {
      source: { type: 'code' },
    },
    docsStyles: true,
  },
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  parameters: {
    relativeCsfPaths: ['../examples/Button.stories'],
  },
};
export const WithoutPrimaryStory: Story = {
  args: { includePrimary: false },
  parameters: {
    relativeCsfPaths: ['../examples/Button.stories'],
  },
};
export const DifferentToolbars: Story = {
  parameters: {
    relativeCsfPaths: ['../examples/StoriesParameters.stories'],
  },
};
export const NoAutodocs: Story = {
  parameters: {
    relativeCsfPaths: ['../examples/ButtonNoAutodocs.stories'],
  },
};
export const SomeAutodocs: Story = {
  parameters: {
    relativeCsfPaths: ['../examples/ButtonSomeAutodocs.stories'],
  },
};
export const DefaultWithOf: Story = {
  name: 'Default with Of',
  args: {
    of: DefaultButtonStories,
  },
  parameters: {
    relativeCsfPaths: ['../examples/Button.stories'],
  },
};
export const WithoutPrimaryStoryWithOf: Story = {
  name: 'Without Primary Story with Of',
  args: {
    includePrimary: false,
    of: DefaultButtonStories,
  },
  parameters: {
    relativeCsfPaths: ['../examples/Button.stories'],
  },
};
export const DifferentToolbarsWithOf: Story = {
  name: 'Different Toolbars with Of',
  args: {
    of: ParameterStories,
  },
  parameters: {
    relativeCsfPaths: ['../examples/StoriesParameters.stories'],
  },
};
export const DifferentTitleWithOf: Story = {
  name: 'Different Title with Of',
  args: {
    title: 'Different Title',
    of: ParameterStories,
  },
  parameters: {
    relativeCsfPaths: ['../examples/StoriesParameters.stories'],
  },
};
export const NoAutodocsWithOf: Story = {
  args: {
    of: ButtonNoAutodocs,
  },
  parameters: {
    relativeCsfPaths: ['../examples/ButtonNoAutodocs.stories'],
  },
};
export const SomeAutodocsWithOf: Story = {
  args: {
    of: ButtonSomeAutodocs,
  },
  parameters: {
    relativeCsfPaths: ['../examples/ButtonSomeAutodocs.stories'],
  },
};
export const DefaultAttached: Story = {
  parameters: { relativeCsfPaths: ['../examples/Button.stories'], attached: true },
};
export const OfStringMetaAttached: Story = {
  name: 'Of "meta" Attached',
  args: {
    of: 'meta',
  },
  parameters: { relativeCsfPaths: ['../examples/Button.stories'], attached: true },
};
