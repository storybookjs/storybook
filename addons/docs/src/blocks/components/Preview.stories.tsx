import type { ComponentProps } from 'react';
import React from 'react';

import { Button, Spaced } from 'storybook/internal/components';
import type { DocsContextProps, ModuleExport } from 'storybook/internal/types';

import { styled } from 'storybook/theming';

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

const preview = (window as any).__STORYBOOK_PREVIEW__;
const renderStoryToElement = preview.renderStoryToElement.bind(preview);

const getPreparedStory = (docsContext: DocsContextProps, moduleExport: ModuleExport) => {
  return docsContext.resolveOf(moduleExport, ['story']).story;
};

export const Loading = () => <PreviewSkeleton />;

export const CodeCollapsed = () => (
  <Preview inline isExpanded={false} withSource={sourceStories.JSX.args}>
    <Button ariaLabel={false} variant="outline">
      Button 1
    </Button>
  </Preview>
);

export const CodeExpanded = () => (
  <Preview inline isExpanded withSource={sourceStories.JSX.args}>
    <Button ariaLabel={false} variant="outline">
      Button 1
    </Button>
  </Preview>
);

export const CodeError = () => (
  <Preview inline isExpanded withSource={sourceStories.SourceUnavailable.args}>
    <Button ariaLabel={false} variant="outline">
      Button 1
    </Button>
  </Preview>
);

export const Single = () => (
  <Preview inline>
    <Button ariaLabel={false} variant="outline">
      Button 1
    </Button>
  </Preview>
);

export const Row = () => (
  <Preview inline>
    <Button ariaLabel={false} variant="outline">
      Button 1
    </Button>
    <Button ariaLabel={false} variant="outline">
      Button 2
    </Button>
    <Button ariaLabel={false} variant="outline">
      Button 3
    </Button>
    <Button ariaLabel={false} variant="outline">
      Button 4
    </Button>
    <Button ariaLabel={false} variant="outline">
      Button 5
    </Button>
    <Button ariaLabel={false} variant="outline">
      Button 6
    </Button>
    <Button ariaLabel={false} variant="outline">
      Button 7
    </Button>
  </Preview>
);

export const Column = () => (
  <Preview inline isColumn>
    <Button ariaLabel={false} variant="outline">
      Button 1
    </Button>
    <Button ariaLabel={false} variant="outline">
      Button 2
    </Button>
    <Button ariaLabel={false} variant="outline">
      Button 3
    </Button>
  </Preview>
);

export const GridWith3Columns = () => (
  <Preview inline columns={3}>
    <Button ariaLabel={false} variant="outline">
      Button 1
    </Button>
    <Button ariaLabel={false} variant="outline">
      Button 2
    </Button>
    <Button ariaLabel={false} variant="outline">
      Button 3
    </Button>
    <Button ariaLabel={false} variant="outline">
      Button 4
    </Button>
    <Button ariaLabel={false} variant="outline">
      Button 5
    </Button>
    <Button ariaLabel={false} variant="outline">
      Button 6
    </Button>
    <Button ariaLabel={false} variant="outline">
      Button 7 long long long long long{' '}
    </Button>
    <Button ariaLabel={false} variant="outline">
      Button 8
    </Button>
    <Button ariaLabel={false} variant="outline">
      Button 9
    </Button>
    <Button ariaLabel={false} variant="outline">
      Button 10
    </Button>
    <Button ariaLabel={false} variant="outline">
      Button 11
    </Button>
    <Button ariaLabel={false} variant="outline">
      Button 12
    </Button>
    <Button ariaLabel={false} variant="outline">
      Button 13
    </Button>
    <Button ariaLabel={false} variant="outline">
      Button 14
    </Button>
    <Button ariaLabel={false} variant="outline">
      Button 15
    </Button>
    <Button ariaLabel={false} variant="outline">
      Button 16
    </Button>
    <Button ariaLabel={false} variant="outline">
      Button 17
    </Button>
    <Button ariaLabel={false} variant="outline">
      Button 18
    </Button>
    <Button ariaLabel={false} variant="outline">
      Button 19
    </Button>
    <Button ariaLabel={false} variant="outline">
      Button 20
    </Button>
  </Preview>
);

export const WithToolbar = (
  args: any,
  { loaded: { docsContext } }: { loaded: { docsContext: DocsContextProps } }
) => (
  <Preview inline withToolbar>
    <Story
      inline
      story={getPreparedStory(docsContext, ButtonStories.Primary)}
      renderStoryToElement={renderStoryToElement}
      autoplay={false}
      forceInitialArgs={false}
      primary={false}
      height="36px"
    />
  </Preview>
);

const Horizontal = styled((props: ComponentProps<typeof Spaced>) => <Spaced col={1} {...props} />)({
  display: 'grid',
  gridTemplateColumns: '100px calc(100vw + 100px) 100px',
});

export const Wide = () => (
  <Preview inline withToolbar>
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
  <Preview inline withToolbar>
    <Story
      inline
      story={getPreparedStory(docsContext, ButtonStories.Primary)}
      renderStoryToElement={renderStoryToElement}
      autoplay={false}
      forceInitialArgs={false}
      primary={false}
      height="36px"
    />
    <Story
      inline
      story={getPreparedStory(docsContext, ButtonStories.Primary)}
      renderStoryToElement={renderStoryToElement}
      autoplay={false}
      forceInitialArgs={false}
      primary={false}
      height="36px"
    />
  </Preview>
);

export const WithFullscreenSingle = (
  args: any,
  { loaded: { docsContext } }: { loaded: { docsContext: DocsContextProps } }
) => (
  <Preview inline withToolbar layout="fullscreen">
    <Story
      inline
      story={getPreparedStory(docsContext, ButtonStories.Primary)}
      renderStoryToElement={renderStoryToElement}
      autoplay={false}
      forceInitialArgs={false}
      primary={false}
      height="36px"
    />
  </Preview>
);

export const WithFullscreenMulti = (
  args: any,
  { loaded: { docsContext } }: { loaded: { docsContext: DocsContextProps } }
) => (
  <Preview inline withToolbar layout="fullscreen">
    <Story
      inline
      story={getPreparedStory(docsContext, ButtonStories.Primary)}
      renderStoryToElement={renderStoryToElement}
      autoplay={false}
      forceInitialArgs={false}
      primary={false}
      height="36px"
    />
    <Story
      inline
      story={getPreparedStory(docsContext, ButtonStories.Primary)}
      renderStoryToElement={renderStoryToElement}
      autoplay={false}
      forceInitialArgs={false}
      primary={false}
      height="36px"
    />
  </Preview>
);

export const WithCenteredSingle = (
  args: any,
  { loaded: { docsContext } }: { loaded: { docsContext: DocsContextProps } }
) => (
  <Preview inline withToolbar layout="centered">
    <Story
      inline
      story={getPreparedStory(docsContext, ButtonStories.Centered)}
      renderStoryToElement={renderStoryToElement}
      autoplay={false}
      forceInitialArgs={false}
      primary={false}
      height="36px"
    />
  </Preview>
);

export const WithCenteredIframe = (
  args: any,
  { loaded: { docsContext } }: { loaded: { docsContext: DocsContextProps } }
) => (
  <Preview inline={false} withToolbar layout="centered">
    <Story
      inline={false}
      story={getPreparedStory(docsContext, ButtonStories.Centered)}
      primary={false}
      height="100px"
    />
  </Preview>
);

export const WithCenteredMulti = (
  args: any,
  { loaded: { docsContext } }: { loaded: { docsContext: DocsContextProps } }
) => (
  <Preview inline withToolbar layout="centered">
    <Story
      inline
      story={getPreparedStory(docsContext, ButtonStories.Centered)}
      renderStoryToElement={renderStoryToElement}
      autoplay={false}
      forceInitialArgs={false}
      primary={false}
      height="36px"
    />
    <Story
      inline
      story={getPreparedStory(docsContext, ButtonStories.Centered)}
      renderStoryToElement={renderStoryToElement}
      autoplay={false}
      forceInitialArgs={false}
      primary={false}
      height="36px"
    />
  </Preview>
);

export const WithAdditionalActions = () => (
  <Preview
    inline
    additionalActions={[
      {
        title: 'Open on GitHub',
        onClick: () => {
          globalThis.location.href =
            'https://github.com/storybookjs/storybook/blob/next/lib/blocks/src/components/Preview.stories.tsx#L165-L186';
        },
      },
    ]}
  >
    <Button ariaLabel={false} variant="outline">
      Button 1
    </Button>
  </Preview>
);
