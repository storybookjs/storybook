import React, { type FC, Fragment, useEffect } from 'react';

import type { Channel } from 'storybook/internal/channels';

import { global } from '@storybook/global';

import type { Decorator, Loader, ReactRenderer } from '@storybook/react-vite';
import { definePreview } from '@storybook/react-vite';

import addonA11y from '@storybook/addon-a11y';
// TODO add empty preview
// import * as designs from '@storybook/addon-designs/preview';
import addonDocs from '@storybook/addon-docs';
import { DocsContext } from '@storybook/addon-docs/blocks';
import addonThemes from '@storybook/addon-themes';
import addonTest from '@storybook/addon-vitest';

import addonPseudoStates from 'storybook-addon-pseudo-states';
import { DocsContext as DocsContextProps, useArgs } from 'storybook/preview-api';
import type { PreviewWeb } from 'storybook/preview-api';
import { sb } from 'storybook/test';
import {
  Global,
  ThemeProvider,
  convert,
  createReset,
  styled,
  themes,
  useTheme,
} from 'storybook/theming';

import { DocsPageWrapper } from '../addons/docs/src/blocks/components';
import * as templatePreview from '../core/template/stories/preview';
import '../renderers/react/template/components/index';
import { isChromatic } from './isChromatic';

sb.mock('../core/template/stories/test/ModuleMocking.utils.ts');
sb.mock('../core/template/stories/test/ModuleSpyMocking.utils.ts', { spy: true });
sb.mock('../core/template/stories/test/ModuleAutoMocking.utils.ts');
/* eslint-disable depend/ban-dependencies */
sb.mock(import('lodash-es'));
sb.mock(import('lodash-es/add'));
sb.mock(import('lodash-es/sum'));
sb.mock(import('uuid'));
/* eslint-enable depend/ban-dependencies */

const { document } = global;
globalThis.CONFIG_TYPE = 'DEVELOPMENT';

const ThemeBlock = styled.div<{ side: 'left' | 'right'; layout: string }>(
  {
    position: 'absolute',
    top: 0,
    left: 0,
    right: '50vw',
    width: '50vw',
    height: '100vh',
    bottom: 0,
    overflow: 'auto',
  },
  ({ layout }) => ({
    padding: layout === 'fullscreen' ? 0 : '1rem',
  }),
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

const ThemeStack = styled.div<{ layout: string }>(
  {
    position: 'relative',
    flex: 1,
  },
  ({ theme }) => ({
    background: theme.background.content,
    color: theme.color.defaultText,
  }),
  ({ layout }) => ({
    padding: layout === 'fullscreen' ? 0 : '1rem',
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
    zIndex: 99,
    '> *': {
      display: 'block',
    },
  },
  ({ theme }) => ({
    background: '#fffbd9',
    color: theme.color.defaultText,
  })
);

const StackContainer: FC<React.PropsWithChildren<{ layout: string }>> = ({ children, layout }) => (
  <div
    style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
    }}
  >
    <style dangerouslySetInnerHTML={{ __html: 'html, body, #storybook-root { height: 100%; }' }} />
    {layout === 'fullscreen' ? null : (
      <style
        dangerouslySetInnerHTML={{ __html: 'html, body { padding: 0!important; margin: 0; }' }}
      />
    )}
    {children}
  </div>
);

const ThemedSetRoot = () => {
  const theme = useTheme();

  useEffect(() => {
    document.body.style.background = theme.background.content;
    document.body.style.color = theme.color.defaultText;
  });

  return null;
};

const loaders = [
  /**
   * This loader adds a DocsContext to the story, which is required for the most Blocks to work. A
   * story will specify which stories they need in the index with:
   *
   * ```ts
   * parameters: {
   *   relativeCsfPaths: ['../stories/MyStory.stories.tsx'], // relative to the story
   * }
   * ```
   *
   * The DocsContext will then be added via the decorator below.
   */
  async ({ parameters: { relativeCsfPaths, attached = true } }) => {
    const preview = (window as any).__STORYBOOK_PREVIEW__ as PreviewWeb<ReactRenderer> | undefined;
    const channel = (window as any).__STORYBOOK_ADDONS_CHANNEL__ as Channel | undefined;
    // __STORYBOOK_PREVIEW__ and __STORYBOOK_ADDONS_CHANNEL__ is set in the PreviewWeb constructor
    // which isn't loaded in portable stories/vitest
    if (!relativeCsfPaths || !preview || !channel) {
      return {};
    }
    const csfFiles = await Promise.all(
      (relativeCsfPaths as string[]).map(async (blocksRelativePath) => {
        const projectRelativePath = `./addons/docs/src/blocks/${blocksRelativePath.replace(
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
] as Loader[];

const decorators = [
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
   * This decorator renders the stories side-by-side, stacked or default based on the theme switcher
   * in the toolbar
   */
  (StoryFn, { globals, playFunction, testFunction, args, storyGlobals, parameters }) => {
    let theme = globals.sb_theme;
    let showPlayFnNotice = false;

    // this makes the decorator be out of 'phase' with the actually selected theme in the toolbar
    // but this is acceptable, I guess
    // we need to ensure only a single rendering in chromatic
    // a more 'correct' approach would be to set a specific theme global on every story that has a playFunction
    if (
      (testFunction || (playFunction && args.autoplay !== false)) &&
      !(theme === 'light' || theme === 'dark')
    ) {
      theme = 'light';
      showPlayFnNotice = true;
    } else if (isChromatic() && !storyGlobals.sb_theme && !playFunction && !testFunction) {
      theme = 'stacked';
    }

    switch (theme) {
      case 'side-by-side': {
        return (
          <Fragment>
            <ThemeProvider theme={convert(themes.light)}>
              <Global styles={createReset} />
            </ThemeProvider>
            <ThemeProvider theme={convert(themes.light)}>
              <ThemeBlock side="left" data-side="left" layout={parameters.layout}>
                <StoryFn />
              </ThemeBlock>
            </ThemeProvider>
            <ThemeProvider theme={convert(themes.dark)}>
              <ThemeBlock side="right" data-side="right" layout={parameters.layout}>
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
            <StackContainer layout={parameters.layout}>
              <ThemeProvider theme={convert(themes.light)}>
                <ThemeStack data-side="left" layout={parameters.layout}>
                  <StoryFn />
                </ThemeStack>
              </ThemeProvider>
              <ThemeProvider theme={convert(themes.dark)}>
                <ThemeStack data-side="right" layout={parameters.layout}>
                  <StoryFn />
                </ThemeStack>
              </ThemeProvider>
            </StackContainer>
          </Fragment>
        );
      }
      case 'default':
      default: {
        return (
          <ThemeProvider theme={convert(themes[theme])}>
            <Global styles={createReset} />
            <ThemedSetRoot />
            {showPlayFnNotice && (
              <>
                <PlayFnNotice>
                  <span>
                    Detected play/test function in Chromatic. Rendering only light theme to avoid
                    multiple play/test functions in the same story.
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
   * This decorator shows the current state of the arg named in the parameters.withRawArg property,
   * by updating the arg in the onChange function this also means that the arg will sync with the
   * control panel
   *
   * If parameters.withRawArg is not set, this decorator will do nothing
   */
  (StoryFn, { parameters, args }) => {
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
              // @ts-expect-error onChange is not a valid arg
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
] satisfies Decorator[];

const parameters = {
  docs: {
    theme: themes.light,
    codePanel: true,
    source: {
      transform: async (source) => {
        try {
          const prettier = await import('prettier/standalone');
          const prettierPluginBabel = await import('prettier/plugins/babel');
          const prettierPluginEstree = (await import('prettier/plugins/estree')).default;

          return await prettier.format(source, {
            parser: 'babel',
            plugins: [prettierPluginBabel, prettierPluginEstree],
          });
        } catch (error) {
          console.error(error);
          return source;
        }
      },
    },
    toc: {},
  },
  controls: {
    presetColors: [
      { color: '#ff4785', title: 'Coral' },
      { color: '#1EA7FD', title: 'Ocean' },
      { color: 'rgb(252, 82, 31)', title: 'Orange' },
      { color: 'rgba(255, 174, 0, 0.5)', title: 'Gold' },
      { color: 'hsl(102, 30.20%, 74.70%)', title: 'Green' },
      { color: 'hsla(179,65%,53%,0.5)', title: 'Seafoam' },
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
      'hsla(240,11%,91%,0.5)',
      'slategray',
    ],
  },
  themes: {
    disable: true,
  },
  backgrounds: {
    options: {
      light: { name: 'light', value: '#F6F9FC' },
      dark: { name: 'dark', value: '#1B1C1D' },
      blue: { name: 'blue', value: '#1b1a2c' },
    },
    grid: {
      cellSize: 15,
      cellAmount: 10,
      opacity: 0.4,
    },
  },
};

export default definePreview({
  addons: [
    addonDocs(),
    addonThemes(),
    addonA11y(),
    addonTest(),
    addonPseudoStates(),
    templatePreview,
  ],
  decorators,
  loaders,
  tags: ['test', 'vitest'],
  parameters,
});
