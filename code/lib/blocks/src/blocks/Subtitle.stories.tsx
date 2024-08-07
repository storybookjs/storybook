import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { Subtitle } from './Subtitle';
import * as DefaultButtonStories from '../examples/Button.stories';
import * as ButtonStoriesWithMetaSubtitleAsBoth from '../examples/ButtonWithMetaSubtitleAsBoth.stories';
import * as ButtonStoriesWithMetaSubtitleAsComponentSubtitle from '../examples/ButtonWithMetaSubtitleAsComponentSubtitle.stories';
import * as ButtonStoriesWithMetaSubtitleAsDocsSubtitle from '../examples/ButtonWithMetaSubtitleAsDocsSubtitle.stories';

const meta: Meta<typeof Subtitle> = {
  component: Subtitle,
  parameters: {
    layout: 'fullscreen',
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

export const OfCSFFileAsBoth: Story = {
  args: {
    of: ButtonStoriesWithMetaSubtitleAsBoth,
  },
  parameters: {
    relativeCsfPaths: ['../examples/ButtonWithMetaSubtitleAsBoth.stories'],
  },
};
export const OfCSFFileAsComponentSubtitle: Story = {
  name: 'Of CSF File As parameters.componentSubtitle',
  args: {
    of: ButtonStoriesWithMetaSubtitleAsComponentSubtitle,
  },
  parameters: {
    relativeCsfPaths: ['../examples/ButtonWithMetaSubtitleAsComponentSubtitle.stories'],
  },
};
export const OfCSFFileAsDocsSubtitle: Story = {
  name: 'Of CSF File As parameters.docs.subtitle',
  args: {
    of: ButtonStoriesWithMetaSubtitleAsDocsSubtitle,
  },
  parameters: {
    relativeCsfPaths: ['../examples/ButtonWithMetaSubtitleAsDocsSubtitle.stories'],
  },
};
export const OfMetaAsBoth: Story = {
  args: {
    of: ButtonStoriesWithMetaSubtitleAsBoth.default,
  },
  parameters: {
    relativeCsfPaths: ['../examples/ButtonWithMetaSubtitleAsBoth.stories'],
  },
};
export const OfMetaAsComponentSubtitle: Story = {
  name: 'Of Meta As parameters.componentSubtitle',
  args: {
    of: ButtonStoriesWithMetaSubtitleAsComponentSubtitle.default,
  },
  parameters: {
    relativeCsfPaths: ['../examples/ButtonWithMetaSubtitleAsComponentSubtitle.stories'],
  },
};
export const OfMetaAsDocsSubtitle: Story = {
  name: 'Of Meta As parameters.docs.subtitle',
  args: {
    of: ButtonStoriesWithMetaSubtitleAsDocsSubtitle.default,
  },
  parameters: {
    relativeCsfPaths: ['../examples/ButtonWithMetaSubtitleAsDocsSubtitle.stories'],
  },
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
export const OfStringMetaAttached: Story = {
  name: 'Of "meta" Attached',
  args: {
    of: 'meta',
  },
  parameters: { relativeCsfPaths: ['../examples/Button.stories'], attached: true },
};
export const Children: Story = {
  parameters: { relativeCsfPaths: ['../examples/Button.stories'], attached: false },
  render: () => <Subtitle>This subtitle is a string passed as a children</Subtitle>,
};
