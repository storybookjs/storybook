import type { Meta, StoryObj } from '@storybook/react';
import { Source, SourceError } from './Source';

const meta: Meta<typeof Source> = {
  component: Source,
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Loading: Story = {
  args: { isLoading: true },
};

export const JSX: Story = {
  args: {
    code: `
<MyComponent boolProp scalarProp={1} complexProp={{ foo: 1, bar: '2' }}>
  <SomeOtherComponent funcProp={(a) => a.id} />
</MyComponent>
`,
    language: 'jsx',
    format: false,
  },
};

export const CSSWithDarkMode: Story = {
  args: {
    code: `
@-webkit-keyframes blinker {
  from { opacity: 1.0; }
  to { opacity: 0.0; }
}

.waitingForConnection {
  -webkit-animation-name: blinker;
  -webkit-animation-iteration-count: infinite;
  -webkit-animation-timing-function: cubic-bezier(.5, 0, 1, 1);
  -webkit-animation-duration: 1.7s;
}
`,
    language: 'css',
    format: false,
    dark: true,
  },
};

export const GraphQLWithFormatting: Story = {
  args: {
    code: `query HeroNameAndFriends($episode: Episode) {
          hero(episode: $episode) {
            name
            friends {
              name
            }
          }
        }
`,
    language: 'graphql',
    format: true,
  },
};

export const NoStory: Story = {
  args: {
    error: SourceError.NO_STORY,
    format: false,
  },
};

export const SourceUnavailable: Story = {
  args: {
    error: SourceError.SOURCE_UNAVAILABLE,
    format: false,
  },
};
