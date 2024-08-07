import type { Meta, StoryObj } from '@storybook/react';
import { Primary } from './Primary';
import * as DefaultButtonStories from '../examples/Button.stories';
import * as StoriesParametersStories from '../examples/StoriesParameters.stories';

const meta = {
  component: Primary,
  parameters: {
    layout: 'fullscreen',
    // workaround for https://github.com/storybookjs/storybook/issues/20505
    docs: { source: { type: 'code' } },
    docsStyles: true,
  },
} satisfies Meta<typeof Primary>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  parameters: {
    relativeCsfPaths: ['../examples/Button.stories'],
  },
};
export const WithoutToolbar: Story = {
  parameters: {
    relativeCsfPaths: ['../examples/StoriesParameters.stories'],
  },
};

export const DefaultWithOf: Story = {
  name: 'Of',
  args: {
    of: DefaultButtonStories,
  },
  parameters: { relativeCsfPaths: ['../examples/Button.stories'] },
};

export const WithoutToolbarWithOf: Story = {
  name: 'Of Without Toolbar',
  args: {
    of: StoriesParametersStories,
  },
  parameters: { relativeCsfPaths: ['../examples/StoriesParameters.stories'] },
};

export const DefaultOfStringMetaAttached: Story = {
  name: 'Of Attached "meta"',
  args: {
    of: 'meta',
  },
  parameters: { relativeCsfPaths: ['../examples/Button.stories'] },
};

export const WithoutToolbarOfStringMetaAttached: Story = {
  name: 'Of Attached "meta" Without Toolbar',
  args: {
    of: 'meta',
  },
  parameters: { relativeCsfPaths: ['../examples/StoriesParameters.stories'] },
};
