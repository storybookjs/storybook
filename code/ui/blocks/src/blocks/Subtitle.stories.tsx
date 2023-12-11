import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { Subtitle } from './Subtitle';
import * as DefaultButtonStories from '../examples/Button.stories';
import * as ButtonStoriesWithMetaSubtitleInBoth from '../examples/ButtonWithMetaSubtitleInBoth.stories';
import * as ButtonStoriesWithMetaSubtitleInComponentSubtitle from '../examples/ButtonWithMetaSubtitleInComponentSubtitle.stories';
import * as ButtonStoriesWithMetaSubtitleInDocsSubtitle from '../examples/ButtonWithMetaSubtitleInDocsSubtitle.stories';

const meta: Meta<typeof Subtitle> = {
  component: Subtitle,
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

export const OfCSFFileInBoth: Story = {
  args: {
    of: ButtonStoriesWithMetaSubtitleInBoth,
  },
  parameters: {
    relativeCsfPaths: ['../examples/ButtonWithMetaSubtitleInBoth.stories'],
  },
};
export const OfCSFFileInComponentSubtitle: Story = {
  name: 'Of CSF File In parameters.componentSubtitle',
  args: {
    of: ButtonStoriesWithMetaSubtitleInComponentSubtitle,
  },
  parameters: {
    relativeCsfPaths: ['../examples/ButtonWithMetaSubtitleInComponentSubtitle.stories'],
  },
};
export const OfCSFFileInDocsSubtitle: Story = {
  name: 'Of CSF File In parameters.docs.subtitle',
  args: {
    of: ButtonStoriesWithMetaSubtitleInDocsSubtitle,
  },
  parameters: {
    relativeCsfPaths: ['../examples/ButtonWithMetaSubtitleInDocsSubtitle.stories'],
  },
};
export const OfMetaInBoth: Story = {
  args: {
    of: ButtonStoriesWithMetaSubtitleInBoth.default,
  },
  parameters: {
    relativeCsfPaths: ['../examples/ButtonWithMetaSubtitleInBoth.stories'],
  },
};
export const OfMetaInComponentSubtitle: Story = {
  name: 'Of Meta In parameters.componentSubtitle',
  args: {
    of: ButtonStoriesWithMetaSubtitleInComponentSubtitle.default,
  },
  parameters: {
    relativeCsfPaths: ['../examples/ButtonWithMetaSubtitleInComponentSubtitle.stories'],
  },
};
export const OfMetaInDocsSubtitle: Story = {
  name: 'Of Meta In parameters.docs.subtitle',
  args: {
    of: ButtonStoriesWithMetaSubtitleInDocsSubtitle.default,
  },
  parameters: {
    relativeCsfPaths: ['../examples/ButtonWithMetaSubtitleInDocsSubtitle.stories'],
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
  decorators: [(s) => (window?.navigator.userAgent.match(/StorybookTestRunner/) ? <div /> : s())],
};
export const OfStringMetaAttached: Story = {
  name: 'Of "meta" Attached',
  args: {
    of: 'meta',
  },
  parameters: { relativeCsfPaths: ['../examples/Button.stories'], attached: true },
};
export const Children: Story = {
  parameters: { relativeCsfPaths: ['../examples/Button.stories'], attached: true },
  render: () => <Subtitle>This subtitle is set inside the Subtitle element.</Subtitle>,
};
