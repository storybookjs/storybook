import React, { useEffect, useState } from 'react';

import {
  AddonPanel,
  type SupportedLanguage,
  type SyntaxHighlighterFormatTypes,
} from 'storybook/internal/components';

import { addons, types, useChannel, useParameter } from 'storybook/manager-api';
import { ignoreSsrWarning, styled, useTheme } from 'storybook/theming';

import {
  ADDON_ID,
  PANEL_ID,
  PARAM_KEY,
  type StoryDocsCodePanelParameters,
  shouldWaitForServiceSnippet,
  SNIPPET_RENDERED,
} from 'storybook/internal/docs-tools';
import type { StoryId } from 'storybook/internal/types';
import type { SourceParameters } from './blocks/blocks';
import { Source } from './blocks/components/Source';

/** Payload emitted on the `SNIPPET_RENDERED` channel event (see `emitTransformCode`). */
type SnippetRenderedEvent = {
  id?: StoryId;
  source?: string;
  format?: SyntaxHighlighterFormatTypes;
  language?: SupportedLanguage;
};

const CodePanel = ({
  active,
  lastEvent,
  currentStoryId,
  storyParameters,
  storyPrepared,
}: {
  active: boolean | undefined;
  lastEvent: SnippetRenderedEvent | undefined;
  currentStoryId: string | undefined;
  storyParameters: StoryDocsCodePanelParameters | undefined;
  storyPrepared: boolean | undefined;
}) => {
  const lastEventMatchesCurrentStory = lastEvent?.id === currentStoryId;
  const [codeSnippet, setSourceCode] = useState<{
    source: string | undefined;
    format: SyntaxHighlighterFormatTypes | undefined;
    language: SupportedLanguage | undefined;
  }>({
    source: lastEventMatchesCurrentStory ? lastEvent?.source : undefined,
    format: lastEventMatchesCurrentStory ? lastEvent?.format : undefined,
    language: lastEventMatchesCurrentStory ? lastEvent?.language : undefined,
  });

  const parameter = useParameter(PARAM_KEY, {
    source: { code: '' } as SourceParameters,
    theme: 'dark',
  });

  useEffect(() => {
    setSourceCode({
      source: undefined,
      format: undefined,
      language: undefined,
    });
  }, [currentStoryId]);

  useChannel(
    {
      [SNIPPET_RENDERED]: ({ id, source, format, language }) => {
        // Ignore snippets emitted for other stories: a slow extraction for the previously selected
        // story can resolve after navigation and would otherwise overwrite the current panel.
        // `useChannel` captures this handler per `deps`, so it must list `currentStoryId` to compare
        // against the currently selected story rather than the one selected on mount.
        if (id !== undefined && id !== currentStoryId) {
          return;
        }
        setSourceCode({ source, format, language });
      },
    },
    [currentStoryId]
  );

  const theme = useTheme();
  const isDark = theme.base !== 'light';

  const awaitingServiceSnippet = shouldWaitForServiceSnippet(storyParameters, storyPrepared);
  const code =
    parameter.source?.code ||
    codeSnippet.source ||
    (awaitingServiceSnippet ? '' : parameter.source?.originalSource);

  const language = parameter.source?.language ?? codeSnippet.language;

  return (
    <AddonPanel active={!!active}>
      <SourceStyles>
        <Source
          {...parameter.source}
          code={code}
          language={language}
          format={codeSnippet.format}
          dark={isDark}
        />
      </SourceStyles>
    </AddonPanel>
  );
};

addons.register(ADDON_ID, (api) => {
  addons.add(PANEL_ID, {
    title: 'Code',
    type: types.PANEL,
    paramKey: PARAM_KEY,
    /**
     * This code panel can be enabled by adding this parameter:
     *
     * @example
     *
     * ```ts
     *  parameters: {
     *    docs: {
     *      codePanel: true,
     *    },
     *  },
     * ```
     */
    disabled: (parameters) => !parameters?.docs?.codePanel,
    match: ({ viewMode }) => viewMode === 'story',
    render: ({ active }) => {
      const channel = api.getChannel();
      const currentStory = api.getCurrentStoryData();

      const lastEvent = channel?.last(SNIPPET_RENDERED)?.[0];

      return (
        <CodePanel
          currentStoryId={currentStory?.id}
          storyParameters={currentStory?.parameters}
          storyPrepared={currentStory?.prepared}
          lastEvent={lastEvent}
          active={active}
        />
      );
    },
  });
});

const SourceStyles = styled.div(() => ({
  height: '100%',
  [`> :first-child${ignoreSsrWarning}`]: {
    margin: 0,
    height: '100%',
    boxShadow: 'none',
  },
}));
