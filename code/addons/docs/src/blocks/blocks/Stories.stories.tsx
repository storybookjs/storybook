import type { Meta, StoryObj } from '@storybook/react-vite';

import * as DefaultButtonStories from '../examples/Button.stories';
import * as StoriesBlockParametersStories from '../examples/StoriesBlockParameters.stories';
import { Stories } from './Stories';

const meta = {
  component: Stories,
  parameters: {
    layout: 'fullscreen',
    docsStyles: true,
    chromatic: {
      delay: 2000,
    },
  },
} satisfies Meta<typeof Stories>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  parameters: {
    relativeCsfPaths: ['../examples/Button.stories'],
  },
};
export const WithoutPrimary: Story = {
  args: { includePrimary: false },
  parameters: {
    relativeCsfPaths: ['../examples/Button.stories'],
  },
};
export const WithoutPrimaryStory: Story = {
  args: { includePrimaryStory: false },
  parameters: {
    relativeCsfPaths: ['../examples/Button.stories'],
  },
};
export const OfCSFFile: Story = {
  args: {
    of: DefaultButtonStories,
  },
  parameters: {
    relativeCsfPaths: ['../examples/Button.stories'],
  },
};
export const WithDocsStoriesParameters: Story = {
  args: {
    of: StoriesBlockParametersStories,
  },
  parameters: {
    relativeCsfPaths: ['../examples/StoriesBlockParameters.stories'],
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
