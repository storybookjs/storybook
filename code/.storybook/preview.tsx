import { global } from '@storybook/global';
import React, { Fragment, useEffect } from 'react';
import { isChromatic } from './isChromatic';
import {
  Global,
  ThemeProvider,
  themes,
  createReset,
  convert,
  styled,
  useTheme,
} from 'storybook/internal/theming';
import { useArgs, DocsContext as DocsContextProps } from 'storybook/internal/preview-api';
import type { PreviewWeb } from 'storybook/internal/preview-api';
import type { ReactRenderer } from '@storybook/react';
import type { Channel } from 'storybook/internal/channels';

import { DocsContext } from '@storybook/blocks';

import { DocsPageWrapper } from '../lib/blocks/src/components';

const { document } = global;

const ThemeBlock = styled.div<{ side: 'left' | 'right' }>(
  {
    position: 'absolute',
    top: 0,
    left: 0,
    right: '50vw',
    width: '50vw',
    height: '100vh',
    bottom: 0,
    overflow: 'auto',
    padding: 10,
  },
  ({ theme }) => ({
    background: theme.background.content,
    color: theme.color.defaultText,
  }),
  ({ side }) =>
    side === 'left'
      ? {
          left: 0,
          right: '50vw',
        }
      : {
          right: 0,
          left: '50vw',
        }
);

const ThemeStack = styled.div(
  {
    position: 'relative',
    minHeight: 'calc(50vh - 15px)',
  },
  ({ theme }) => ({
    background: theme.background.content,
    color: theme.color.defaultText,
  })
);

const PlayFnNotice = styled.div(
  {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    borderBottom: '1px solid #ccc',
    padding: '3px 8px',
    fontSize: '10px',
    fontWeight: 'bold',
    '> *': {
      display: 'block',
    },
  },
  ({ theme }) => ({
    background: '#fffbd9',
    color: theme.color.defaultText,
  })
);

const ThemedSetRoot = () => {
  const theme = useTheme();

  useEffect(() => {
    document.body.style.background = theme.background.content;
    document.body.style.color = theme.color.defaultText;
  });

  return null;
};

// eslint-disable-next-line no-underscore-dangle
const preview = (window as any).__STORYBOOK_PREVIEW__ as PreviewWeb<ReactRenderer>;
const channel = (window as any).__STORYBOOK_ADDONS_CHANNEL__ as Channel;
export const loaders = [
  /**
   * This loader adds a DocsContext to the story, which is required for the most Blocks to work.
   * A story will specify which stories they need in the index with:
   * parameters: {
   *  relativeCsfPaths: ['../stories/MyStory.stories.tsx'], // relative to the story
   * }
   * The DocsContext will then be added via the decorator below.
   */
  async ({ parameters: { relativeCsfPaths, attached = true } }) => {
    if (!relativeCsfPaths) return {};
    const csfFiles = await Promise.all(
      (relativeCsfPaths as string[]).map(async (blocksRelativePath) => {
        const projectRelativePath = `./lib/blocks/src/${blocksRelativePath.replace(
          /^..\//,
          ''
        )}.tsx`;
        const entry = preview.storyStore.storyIndex?.importPathToEntry(projectRelativePath);

        if (!entry) {
          throw new Error(
            `Couldn't find story file at ${projectRelativePath} (passed as ${blocksRelativePath})`
          );
        }

        return preview.storyStore.loadCSFFileByStoryId(entry.id);
      })
    );
    const docsContext = new DocsContextProps(
      channel,
      preview.storyStore,
      preview.renderStoryToElement.bind(preview),
      csfFiles
    );
    if (attached && csfFiles[0]) {
      docsContext.attachCSFFile(csfFiles[0]);
    }
    return { docsContext };
  },
];

export const decorators = [
  // This decorator adds the DocsContext created in the loader above
  (Story, { loaded: { docsContext } }) =>
    docsContext ? (
      <DocsContext.Provider value={docsContext}>
        <Story />
      </DocsContext.Provider>
    ) : (
      <Story />
    ),
  /**
   * This decorator adds wrappers that contains global styles for stories to be targeted by.
   * Activated with parameters.docsStyles = true
   */ (Story, { parameters: { docsStyles } }) =>
    docsStyles ? (
      <DocsPageWrapper>
        <Story />
      </DocsPageWrapper>
    ) : (
      <Story />
    ),
  /**
   * This decorator renders the stories side-by-side, stacked or default based on the theme switcher in the toolbar
   */
  (StoryFn, { globals, parameters, playFunction, args }) => {
    const defaultTheme =
      isChromatic() && !playFunction && args.autoplay !== true ? 'stacked' : 'light';
    const theme = globals.theme || parameters.theme || defaultTheme;

    switch (theme) {
      case 'side-by-side': {
        return (
          <Fragment>
            <ThemeProvider theme={convert(themes.light)}>
              <Global styles={createReset} />
            </ThemeProvider>
            <ThemeProvider theme={convert(themes.light)}>
              <ThemeBlock side="left" data-side="left">
                <StoryFn />
              </ThemeBlock>
            </ThemeProvider>
            <ThemeProvider theme={convert(themes.dark)}>
              <ThemeBlock side="right" data-side="right">
                <StoryFn />
              </ThemeBlock>
            </ThemeProvider>
          </Fragment>
        );
      }
      case 'stacked': {
        return (
          <Fragment>
            <ThemeProvider theme={convert(themes.light)}>
              <Global styles={createReset} />
            </ThemeProvider>
            <ThemeProvider theme={convert(themes.light)}>
              <ThemeStack data-side="left">
                <StoryFn />
              </ThemeStack>
            </ThemeProvider>
            <ThemeProvider theme={convert(themes.dark)}>
              <ThemeStack data-side="right">
                <StoryFn />
              </ThemeStack>
            </ThemeProvider>
          </Fragment>
        );
      }
      case 'default':
      default: {
        return (
          <ThemeProvider theme={convert(themes[theme])}>
            <Global styles={createReset} />
            <ThemedSetRoot />
            {!parameters.theme && isChromatic() && playFunction && (
              <>
                <PlayFnNotice>
                  <span>
                    Detected play function in Chromatic. Rendering only light theme to avoid
                    multiple play functions in the same story.
                  </span>
                </PlayFnNotice>
                <div style={{ marginBottom: 20 }} />
              </>
            )}
            <StoryFn />
          </ThemeProvider>
        );
      }
    }
  },
  /**
   * This decorator shows the current state of the arg named in the
   * parameters.withRawArg property, by updating the arg in the onChange function
   * this also means that the arg will sync with the control panel
   *
   * If parameters.withRawArg is not set, this decorator will do nothing
   */
  (StoryFn, { parameters, args, hooks }) => {
    const [, updateArgs] = useArgs();
    if (!parameters.withRawArg) {
      return <StoryFn />;
    }

    return (
      <>
        <StoryFn
          args={{
            ...args,
            onChange: (newValue) => {
              updateArgs({ [parameters.withRawArg]: newValue });
              args.onChange?.(newValue);
            },
          }}
        />
        <div style={{ marginTop: '1rem' }}>
          Current <code>{parameters.withRawArg}</code>:{' '}
          <pre>{JSON.stringify(args[parameters.withRawArg], null, 2) || 'undefined'}</pre>
        </div>
      </>
    );
  },
];

export const parameters = {
  options: {
    storySort: (a, b) =>
      a.title === b.title ? 0 : a.id.localeCompare(b.id, undefined, { numeric: true }),
  },
  docs: {
    theme: themes.light,
    toc: {},
  },
  controls: {
    presetColors: [
      { color: '#ff4785', title: 'Coral' },
      { color: '#1EA7FD', title: 'Ocean' },
      { color: 'rgb(252, 82, 31)', title: 'Orange' },
      { color: 'RGBA(255, 174, 0, 0.5)', title: 'Gold' },
      { color: 'hsl(101, 52%, 49%)', title: 'Green' },
      { color: 'HSLA(179,65%,53%,0.5)', title: 'Seafoam' },
      { color: '#6F2CAC', title: 'Purple' },
      { color: '#2A0481', title: 'Ultraviolet' },
      { color: 'black' },
      { color: '#333', title: 'Darkest' },
      { color: '#444', title: 'Darker' },
      { color: '#666', title: 'Dark' },
      { color: '#999', title: 'Mediumdark' },
      { color: '#ddd', title: 'Medium' },
      { color: '#EEE', title: 'Mediumlight' },
      { color: '#F3F3F3', title: 'Light' },
      { color: '#F8F8F8', title: 'Lighter' },
      { color: '#FFFFFF', title: 'Lightest' },
      '#fe4a49',
      '#FED766',
      'rgba(0, 159, 183, 1)',
      'HSLA(240,11%,91%,0.5)',
      'slategray',
    ],
  },
};
