import React from 'react';
import { SourceType } from 'storybook/internal/docs-tools';
import type { Meta, StoryObj } from '@storybook/react';

import { dedent } from 'ts-dedent';
import { Source } from './Source';
import * as ParametersStories from '../examples/SourceParameters.stories';
import { argsHash, SourceContext } from './SourceContainer';

const meta: Meta<typeof Source> = {
  component: Source,
  parameters: {
    layout: 'fullscreen',
    relativeCsfPaths: ['../examples/SourceParameters.stories'],
    snippets: {
      'storybook-blocks-examples-stories-for-the-source-block--no-parameters': {
        [argsHash({})]: {
          code: `const emitted = 'source';`,
        },
      },
      'storybook-blocks-examples-stories-for-the-source-block--transform': {
        [argsHash({})]: {
          code: `const emitted = 'source';`,
        },
      },
      'storybook-blocks-examples-stories-for-the-source-block--type-dynamic': {
        [argsHash({})]: {
          code: `const emitted = 'source';`,
        },
      },
    },
    docsStyles: true,
  },
  decorators: [
    (Story, { parameters: { snippets = {} } }) => (
      <SourceContext.Provider value={{ sources: snippets }}>
        <Story />
      </SourceContext.Provider>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof meta>;

const code = `query HeroNameAndFriends($episode: Episode) {
          hero(episode: $episode) {
            name
            friends {
              name
            }
          }
        }
`;

export const DefaultAttached = {};

export const Of: Story = {
  args: {
    of: ParametersStories.NoParameters,
  },
};

export const OfUndefined: Story = {
  args: {
    // @ts-expect-error this is supposed to be undefined
    // eslint-disable-next-line import/namespace
    of: ParametersStories.NotDefined,
  },
  parameters: { chromatic: { disableSnapshot: true } },
  tags: ['!test'],
};

export const OfTypeProp: Story = {
  args: {
    of: ParametersStories.NoParameters,
    type: SourceType.CODE,
  },
};

export const OfTypeParameter: Story = {
  args: {
    of: ParametersStories.TypeCode,
  },
};

export const OfTransformProp: Story = {
  args: {
    of: ParametersStories.NoParameters,
    transform: (src, storyContext) => dedent`// this comment has been added via the transform prop!
    // this is the story id: ${storyContext.id}
    // these are the current args: ${JSON.stringify(storyContext.args)}
    ${src}`,
  },
};

export const OfTransformParameter: Story = {
  args: {
    of: ParametersStories.Transform,
  },
};

export const OfUnattached: Story = {
  args: {
    of: ParametersStories.NoParameters,
  },
  parameters: { attached: false },
};

export const Code: Story = {
  args: { code },
};

export const CodeUnattached: Story = {
  args: { code },
  parameters: { attached: false },
};

export const EmptyUnattached: Story = {
  parameters: { attached: false },
};

export const CodeParameters: Story = {
  args: { of: ParametersStories.Code },
};

export const CodeFormat: Story = {
  args: {
    code,
    format: true,
  },
};

export const CodeFormatParameters: Story = {
  args: { of: ParametersStories.CodeFormat },
};

export const CodeLanguage: Story = {
  args: {
    code,
    language: 'graphql',
    format: true,
  },
};

export const CodeLanguageParameters: Story = {
  args: { of: ParametersStories.CodeLanguage },
};

export const Dark: Story = {
  args: { code, dark: true },
};

export const CodeDarkParameters: Story = {
  args: { of: ParametersStories.CodeDark },
};
