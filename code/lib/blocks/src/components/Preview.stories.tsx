import type { ComponentProps } from 'react';
import React from 'react';

import { Button, Spaced } from 'storybook/internal/components';
import { styled } from 'storybook/internal/theming';
import type { DocsContextProps, ModuleExport } from 'storybook/internal/types';

import { global } from '@storybook/global';

import * as ButtonStories from '../examples/Button.stories';
import { Preview, PreviewSkeleton } from './Preview';
import * as sourceStories from './Source.stories';
import { Story } from './Story';

export default {
  component: Preview,
  parameters: {
    relativeCsfPaths: ['../examples/Button.stories'],
  },
};

// eslint-disable-next-line no-underscore-dangle
const preview = (window as any).__STORYBOOK_PREVIEW__;
const renderStoryToElement = preview.renderStoryToElement.bind(preview);

const getPreparedStory = (docsContext: DocsContextProps, moduleExport: ModuleExport) => {
  return docsContext.resolveOf(moduleExport, ['story']).story;
};

export const Loading = () => <PreviewSkeleton />;

export const CodeCollapsed = () => (
  <Preview isExpanded={false} withSource={sourceStories.JSX.args}>
    <Button secondary>Button 1</Button>
  </Preview>
);

export const CodeExpanded = () => (
  <Preview isExpanded withSource={sourceStories.JSX.args}>
    <Button secondary>Button 1</Button>
  </Preview>
);

export const CodeError = () => (
  <Preview isExpanded withSource={sourceStories.SourceUnavailable.args}>
    <Button secondary>Button 1</Button>
  </Preview>
);

export const Single = () => (
  <Preview>
    <Button secondary>Button 1</Button>
  </Preview>
);

export const Row = () => (
  <Preview>
    <Button secondary>Button 1</Button>
    <Button secondary>Button 2</Button>
    <Button secondary>Button 3</Button>
    <Button secondary>Button 4</Button>
    <Button secondary>Button 5</Button>
    <Button secondary>Button 6</Button>
    <Button secondary>Button 7</Button>
  </Preview>
);

export const Column = () => (
  <Preview isColumn>
    <Button secondary>Button 1</Button>
    <Button secondary>Button 2</Button>
    <Button secondary>Button 3</Button>
  </Preview>
);

export const GridWith3Columns = () => (
  <Preview columns={3}>
    <Button secondary>Button 1</Button>
    <Button secondary>Button 2</Button>
    <Button secondary>Button 3</Button>
    <Button secondary>Button 4</Button>
    <Button secondary>Button 5</Button>
    <Button secondary>Button 6</Button>
    <Button secondary>Button 7 long long long long long </Button>
    <Button secondary>Button 8</Button>
    <Button secondary>Button 9</Button>
    <Button secondary>Button 10</Button>
    <Button secondary>Button 11</Button>
    <Button secondary>Button 12</Button>
    <Button secondary>Button 13</Button>
    <Button secondary>Button 14</Button>
    <Button secondary>Button 15</Button>
    <Button secondary>Button 16</Button>
    <Button secondary>Button 17</Button>
    <Button secondary>Button 18</Button>
    <Button secondary>Button 19</Button>
    <Button secondary>Button 20</Button>
  </Preview>
);

export const WithToolbar = (
  args: any,
  { loaded: { docsContext } }: { loaded: { docsContext: DocsContextProps } }
) => (
  <Preview withToolbar>
    <Story
      inline
      story={getPreparedStory(docsContext, ButtonStories.Primary)}
      renderStoryToElement={renderStoryToElement}
      autoplay={false}
      forceInitialArgs={false}
      primary={false}
      height="100px"
    />
  </Preview>
);

const Horizontal = styled((props: ComponentProps<typeof Spaced>) => <Spaced col={1} {...props} />)({
  display: 'grid',
  gridTemplateColumns: '100px calc(100vw + 100px) 100px',
});

export const Wide = () => (
  <Preview withToolbar>
    <Horizontal>
      <div>START</div>
      <div>middle</div>
      <div>END</div>
    </Horizontal>
  </Preview>
);

export const WithToolbarMulti = (
  args: any,
  { loaded: { docsContext } }: { loaded: { docsContext: DocsContextProps } }
) => (
  <Preview withToolbar>
    <Story
      inline
      story={getPreparedStory(docsContext, ButtonStories.Primary)}
      renderStoryToElement={renderStoryToElement}
      autoplay={false}
      forceInitialArgs={false}
      primary={false}
      height="100px"
    />
    <Story
      inline
      story={getPreparedStory(docsContext, ButtonStories.Primary)}
      renderStoryToElement={renderStoryToElement}
      autoplay={false}
      forceInitialArgs={false}
      primary={false}
      height="100px"
    />
  </Preview>
);

export const WithFullscreenSingle = (
  args: any,
  { loaded: { docsContext } }: { loaded: { docsContext: DocsContextProps } }
) => (
  <Preview withToolbar layout="fullscreen">
    <Story
      inline
      story={getPreparedStory(docsContext, ButtonStories.Primary)}
      renderStoryToElement={renderStoryToElement}
      autoplay={false}
      forceInitialArgs={false}
      primary={false}
      height="100px"
    />
  </Preview>
);

export const WithFullscreenMulti = (
  args: any,
  { loaded: { docsContext } }: { loaded: { docsContext: DocsContextProps } }
) => (
  <Preview withToolbar layout="fullscreen">
    <Story
      inline
      story={getPreparedStory(docsContext, ButtonStories.Primary)}
      renderStoryToElement={renderStoryToElement}
      autoplay={false}
      forceInitialArgs={false}
      primary={false}
      height="100px"
    />
    <Story
      inline
      story={getPreparedStory(docsContext, ButtonStories.Primary)}
      renderStoryToElement={renderStoryToElement}
      autoplay={false}
      forceInitialArgs={false}
      primary={false}
      height="100px"
    />
  </Preview>
);

export const WithCenteredSingle = (
  args: any,
  { loaded: { docsContext } }: { loaded: { docsContext: DocsContextProps } }
) => (
  <Preview withToolbar layout="centered">
    <Story
      inline
      story={getPreparedStory(docsContext, ButtonStories.Primary)}
      renderStoryToElement={renderStoryToElement}
      autoplay={false}
      forceInitialArgs={false}
      primary={false}
      height="100px"
    />
  </Preview>
);

export const WithCenteredMulti = (
  args: any,
  { loaded: { docsContext } }: { loaded: { docsContext: DocsContextProps } }
) => (
  <Preview withToolbar layout="centered">
    <Story
      inline
      story={getPreparedStory(docsContext, ButtonStories.Primary)}
      renderStoryToElement={renderStoryToElement}
      autoplay={false}
      forceInitialArgs={false}
      primary={false}
      height="100px"
    />
    <Story
      inline
      story={getPreparedStory(docsContext, ButtonStories.Primary)}
      renderStoryToElement={renderStoryToElement}
      autoplay={false}
      forceInitialArgs={false}
      primary={false}
      height="100px"
    />
  </Preview>
);

export const WithAdditionalActions = (
  args: any,
  { loaded: { docsContext } }: { loaded: { docsContext: DocsContextProps } }
) => (
  <Preview
    additionalActions={[
      {
        title: 'Open on GitHub',
        onClick: () => {
          global.location.href =
            'https://github.com/storybookjs/storybook/blob/next/code/lib/blocks/src/components/Preview.stories.tsx#L165-L186';
        },
      },
    ]}
  >
    <Button secondary>Button 1</Button>
  </Preview>
);
