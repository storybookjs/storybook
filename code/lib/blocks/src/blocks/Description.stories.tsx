import React from 'react';

import type { Meta, StoryObj } from '@storybook/react';

import { Button as ButtonComponent } from '../examples/Button';
import * as DefaultButtonStories from '../examples/Button.stories';
import * as ButtonStoriesWithMetaDescriptionAsBoth from '../examples/ButtonWithMetaDescriptionAsBoth.stories';
import * as ButtonStoriesWithMetaDescriptionAsComment from '../examples/ButtonWithMetaDescriptionAsComment.stories';
import * as ButtonStoriesWithMetaDescriptionAsParameter from '../examples/ButtonWithMetaDescriptionAsParameter.stories';
import { Description } from './Description';

const meta: Meta<typeof Description> = {
  component: Description,
  parameters: {
    layout: 'fullscreen',
    controls: {
      include: [],
    },
    // workaround for https://github.com/storybookjs/storybook/issues/20505
    docs: { source: { type: 'code' } },
    attached: false,
    docsStyles: true,
  },
};
export default meta;

type Story = StoryObj<typeof meta>;

export const OfComponentAsComponentComment: Story = {
  args: {
    of: ButtonComponent,
  },
  parameters: { relativeCsfPaths: ['../examples/Button.stories'] },
};
export const OfCSFFileAsComponentComment: Story = {
  args: {
    of: DefaultButtonStories,
  },
  parameters: { relativeCsfPaths: ['../examples/Button.stories'] },
};
export const OfCSFFileAsMetaComment: Story = {
  args: {
    of: ButtonStoriesWithMetaDescriptionAsComment,
  },
  parameters: {
    relativeCsfPaths: ['../examples/ButtonWithMetaDescriptionAsComment.stories'],
  },
};
export const OfCSFFileAsParameter: Story = {
  args: {
    of: ButtonStoriesWithMetaDescriptionAsParameter,
  },
  parameters: {
    relativeCsfPaths: ['../examples/ButtonWithMetaDescriptionAsParameter.stories'],
  },
};
export const OfCSFFileAsMetaCommentAndParameter: Story = {
  args: {
    of: ButtonStoriesWithMetaDescriptionAsBoth,
  },
  parameters: {
    relativeCsfPaths: ['../examples/ButtonWithMetaDescriptionAsBoth.stories'],
  },
};
export const OfMetaAsComponentComment: Story = {
  args: {
    of: DefaultButtonStories.default,
  },
  parameters: { relativeCsfPaths: ['../examples/Button.stories'] },
};
export const OfMetaAsMetaComment: Story = {
  args: {
    of: ButtonStoriesWithMetaDescriptionAsComment.default,
  },
  parameters: {
    relativeCsfPaths: ['../examples/ButtonWithMetaDescriptionAsComment.stories'],
  },
};
export const OfMetaAsParameter: Story = {
  args: {
    of: ButtonStoriesWithMetaDescriptionAsParameter.default,
  },
  parameters: {
    relativeCsfPaths: ['../examples/ButtonWithMetaDescriptionAsParameter.stories'],
  },
};
export const OfMetaAsMetaCommentAndParameter: Story = {
  args: {
    of: ButtonStoriesWithMetaDescriptionAsBoth.default,
  },
  parameters: {
    relativeCsfPaths: ['../examples/ButtonWithMetaDescriptionAsBoth.stories'],
  },
};
export const OfStoryAsComment: Story = {
  args: {
    of: DefaultButtonStories.Primary,
  },
  parameters: { relativeCsfPaths: ['../examples/Button.stories'] },
};
export const OfStoryAsParameter: Story = {
  args: {
    of: DefaultButtonStories.Secondary,
  },
  parameters: { relativeCsfPaths: ['../examples/Button.stories'] },
};
export const OfStoryAsStoryCommentAndParameter: Story = {
  args: {
    of: DefaultButtonStories.Large,
  },
  parameters: { relativeCsfPaths: ['../examples/Button.stories'] },
};
export const DefaultAttached: Story = {
  parameters: { relativeCsfPaths: ['../examples/Button.stories'], attached: true },
};
export const OfUndefinedAttached: Story = {
  args: {
    // @ts-expect-error this is supposed to be undefined
    // eslint-disable-next-line import/namespace
    of: DefaultButtonStories.NotDefined,
  },
  parameters: {
    chromatic: { disableSnapshot: true },
    relativeCsfPaths: ['../examples/Button.stories'],
    attached: true,
  },
  tags: ['!test'],
};
export const OfStringComponentAttached: Story = {
  name: 'Of "component" Attached',
  args: {
    of: 'component',
  },
  parameters: { relativeCsfPaths: ['../examples/Button.stories'], attached: true },
};
export const OfStringMetaAttached: Story = {
  name: 'Of "meta" Attached',
  args: {
    of: 'meta',
  },
  parameters: { relativeCsfPaths: ['../examples/Button.stories'], attached: true },
};
export const OfStringStoryAttached: Story = {
  name: 'Of "story" Attached',
  args: {
    of: 'story',
  },
  parameters: { relativeCsfPaths: ['../examples/Button.stories'], attached: true },
};
