import { SourceType } from 'storybook/internal/docs-tools';
import type { StoryContext } from 'storybook/internal/types';

import type { Meta, StoryObj } from '@storybook/react';

import { dedent } from 'ts-dedent';

import { EmptyExample } from './EmptyExample';

const code = `query HeroNameAndFriends($episode: Episode) {
          hero(episode: $episode) {
            name
            friends {
              name
            }
          }
        }
`;

const meta = {
  title: 'examples/Stories for the Source Block',
  component: EmptyExample,
} satisfies Meta<typeof EmptyExample>;
export default meta;

type Story = StoryObj<typeof meta>;

export const NoParameters: Story = {
  args: { something: 'else' },
  // This is here so we can tell if we are looking at the real vs emitted source
};

export const TypeCode: Story = {
  parameters: { docs: { source: { type: SourceType.CODE } } },
};

export const Transform = {
  args: { something: 'else' },
  parameters: {
    docs: {
      source: {
        transform: (
          src: string,
          storyContext: StoryContext
        ) => dedent`// this comment has been added via parameters.docs.source.transform!
        // this is the story id: ${storyContext.id}
        // these are the current args: ${JSON.stringify(storyContext.args)}
        ${src}`,
      },
    },
  },
};

export const Code = {
  parameters: { docs: { source: { code } } },
};

export const CodeFormat = {
  parameters: { docs: { source: { code, format: true } } },
};

export const CodeLanguage = {
  parameters: { docs: { source: { code, format: true, language: 'graphql' } } },
};

export const CodeDark = {
  parameters: { docs: { source: { code, dark: true } } },
};
