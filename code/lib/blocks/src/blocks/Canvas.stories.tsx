import React from 'react';

import type { Meta, StoryObj } from '@storybook/react';

import { dedent } from 'ts-dedent';

import * as ButtonStories from '../examples/Button.stories';
import * as ParameterStories from '../examples/CanvasParameters.stories';
import * as SourceParameterStories from '../examples/SourceParameters.stories';
import { Canvas } from './Canvas';
import SourceStoriesMeta from './Source.stories';

const meta: Meta<typeof Canvas> = {
  component: Canvas,
  parameters: {
    layout: 'fullscreen',
    relativeCsfPaths: [
      '../examples/Button.stories',
      '../examples/CanvasParameters.stories',
      '../examples/SourceParameters.stories',
    ],
    snippets: {
      'storybook-blocks-example-button--primary': {
        code: dedent`
          <Button
            label="Button"
            onClick={() => {}}
            primary={true}
          />`,
      },
    },
    docsStyles: true,
  },
  decorators: SourceStoriesMeta.decorators,
};
export default meta;

type Story = StoryObj<typeof meta>;

export const OfAttached: Story = {
  args: {
    of: ButtonStories.Primary,
  },
};

export const OfUnattached: Story = {
  args: {
    of: ButtonStories.Primary,
  },
  parameters: { attached: false },
};

export const OfError: Story = {
  args: {
    of: ButtonStories.ErrorStory,
  },
};

export const DefaultAttached: Story = {};

export const OfUndefined: Story = {
  args: {
    // @ts-expect-error this is supposed to be undefined
    // eslint-disable-next-line import/namespace
    of: ButtonStories.NotDefined,
  },
  parameters: { chromatic: { disableSnapshot: true } },
  tags: ['!test'],
};

export const PropWithToolbar: Story = {
  name: 'Prop withToolbar = true',
  args: {
    of: ButtonStories.Primary,
    withToolbar: true,
  },
};

export const PropAdditionalActions: Story = {
  name: 'Prop additionalActions = [ ... ]',
  args: {
    of: ButtonStories.Primary,
    additionalActions: [
      {
        title: 'Open in GitHub',
        onClick: () => {
          window.open(
            'https://github.com/storybookjs/storybook/blob/next/code/lib/blocks/src/examples/Button.stories.tsx',
            '_blank'
          );
        },
      },
      {
        title: 'Go to documentation',
        onClick: () => {
          window.open(
            'https://storybook.js.org/docs/react/essentials/controls#annotation',
            '_blank'
          );
        },
      },
    ],
  },
};

export const PropSourceStateShown: Story = {
  name: 'Prop sourceState = shown',
  args: {
    of: ButtonStories.Primary,
    sourceState: 'shown',
  },
};

export const PropSourceStateHidden: Story = {
  name: 'Prop sourceState = hidden',
  args: {
    of: ButtonStories.Primary,
    sourceState: 'hidden',
  },
};

export const PropSourceStateNone: Story = {
  name: 'Prop sourceState = none',
  args: {
    of: ButtonStories.Primary,
    sourceState: 'none',
  },
};

export const PropLayoutFullscreen: Story = {
  name: 'Prop layout = fullscreen',
  args: {
    of: ButtonStories.Primary,
    layout: 'fullscreen',
  },
};

export const PropLayoutCentered: Story = {
  name: 'Prop layout = centered',
  args: {
    of: ButtonStories.Primary,
    layout: 'centered',
  },
};

export const PropLayoutPadded: Story = {
  name: 'Prop layout = padded',
  args: {
    of: ButtonStories.Primary,
    layout: 'padded',
  },
};

export const PropSource: Story = {
  name: 'Prop source = { ... }',
  args: {
    of: ButtonStories.Primary,
    source: {
      language: 'html',
      code: '<button>           Button          </button>', // spaces should be removed by the prettier formatter
      format: 'html',
    },
  },
};

export const PropInlineStory: Story = {
  name: 'Prop story = { ..., inline: true }',
  args: {
    of: ButtonStories.Primary,
    story: { inline: false, height: '200px' },
  },
};

export const PropAutoplayingStory: Story = {
  name: 'Prop story = { ..., autoplay: true}',
  args: {
    of: ButtonStories.Clicking,
    story: { autoplay: true },
  },
};

const ClassNameStoryDescription = () => (
  <p>
    This story sets the <code>className</code> prop on the <code>Canvas</code> to{' '}
    <code>my-custom-classname</code>, which will propagate to the preview element. To demonstrate
    this, it also adds a <code>style</code> tag that sets another background color for that class:
  </p>
);
export const PropClassName: Story = {
  name: 'Prop className = my-custom-classname',
  args: {
    of: ButtonStories.Primary,
    className: 'my-custom-classname',
  },
  render: (args) => (
    <>
      <ClassNameStoryDescription />
      <style>
        {`
          .my-custom-classname {
            background-color: #fd5c9355;
          }
        `}
      </style>
      <Canvas {...args} />
    </>
  ),
};

export const ParameterWithToolbar: Story = {
  name: 'parameters.docs.canvas.withToolbar = true',
  args: {
    of: ParameterStories.WithToolbar,
  },
};

export const ParameterAdditionalActions: Story = {
  name: 'parameters.docs.canvas.additionalActions = [ ... ]',
  args: {
    of: ParameterStories.AdditionalActions,
  },
};

export const ParameterClassName: Story = {
  name: 'parameters.docs.canvas.className = my-custom-classname',
  args: {
    of: ParameterStories.ClassName,
  },
  render: (args) => (
    <>
      <ClassNameStoryDescription />
      <style>
        {`
          .my-custom-classname {
            background-color: #fd5c9355;
          }
        `}
      </style>
      <Canvas {...args} />
    </>
  ),
};

export const ParametersSourceStateShown: Story = {
  name: 'parameters.docs.canvas.sourceState = shown',
  args: {
    of: ParameterStories.SourceStateShown,
  },
};

export const ParametersSourceStateHidden: Story = {
  name: 'parameters.docs.canvas.sourceState = hidden',
  args: {
    of: ParameterStories.SourceStateHidden,
  },
};

export const ParametersSourceStateNone: Story = {
  name: 'parameters.docs.canvas.sourceState = none',
  args: {
    of: ParameterStories.SourceStateNone,
  },
};

export const ParameterDocsCanvasLayoutFullscreen: Story = {
  name: 'parameters.docs.canvas.layout = fullscreen',
  args: {
    of: ParameterStories.DocsCanvasLayoutFullscreen,
  },
};

export const ParameterDocsCanvasLayoutCentered: Story = {
  name: 'parameters.docs.canvas.layout = centered',
  args: {
    of: ParameterStories.DocsCanvasLayoutCentered,
  },
};

export const ParameterDocsCanvasLayoutPadded: Story = {
  name: 'parameters.docs.canvas.layout = padded',
  args: {
    of: ParameterStories.DocsCanvasLayoutPadded,
  },
};

export const ParameterLayoutFullscreen: Story = {
  name: 'parameters.layout = fullscreen',
  args: {
    of: ParameterStories.LayoutFullscreen,
  },
};

export const ParameterLayoutCentered: Story = {
  name: 'parameters.layout = centered',
  args: {
    of: ParameterStories.LayoutCentered,
  },
};

export const ParameterLayoutPadded: Story = {
  name: 'parameters.layout = padded',
  args: {
    of: ParameterStories.LayoutPadded,
  },
};

export const ParameterSource: Story = {
  name: 'parameters.docs.source',
  args: {
    of: SourceParameterStories.CodeLanguage,
  },
};

export const ParameterStory: Story = {
  name: 'parameters.docs.story',
  args: {
    of: ParameterStories.StoryParameters,
  },
};
