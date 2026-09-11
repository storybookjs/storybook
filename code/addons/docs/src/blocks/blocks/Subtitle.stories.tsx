import React from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';

import * as DefaultButtonStories from '../examples/Button.stories';
import * as ButtonStoriesWithMetaSubtitleAsDocsSubtitle from '../examples/ButtonWithMetaSubtitleAsDocsSubtitle.stories';
import { Subtitle } from './Subtitle';

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

export const OfCSFFileAsDocsSubtitle: Story = {
  name: 'Of CSF File As parameters.docs.subtitle',
  args: {
    of: ButtonStoriesWithMetaSubtitleAsDocsSubtitle,
  },
  parameters: {
    relativeCsfPaths: ['../examples/ButtonWithMetaSubtitleAsDocsSubtitle.stories'],
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
