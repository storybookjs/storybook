import React, { useEffect, useState } from 'react';

import {
  AddonPanel,
  type SupportedLanguage,
  type SyntaxHighlighterFormatTypes,
} from 'storybook/internal/components';
import {
  PARAM_KEY,
  SNIPPET_RENDERED,
  shouldWaitForServiceSnippet,
  type StoryDocsCodePanelParameters,
} from 'storybook/internal/docs-tools';
import type { StoryId } from 'storybook/internal/types';
import type { StoryDocsService } from 'storybook/open-service';
import { useChannel, useParameter } from 'storybook/manager-api';
import { ignoreSsrWarning, styled, useTheme } from 'storybook/theming/emotion';

import type { SourceParameters } from './blocks/blocks/Source.tsx';
import { SnippetWarning } from './blocks/components/SnippetWarning.tsx';
import { Source } from './blocks/components/Source.tsx';

type SnippetRenderedEvent = {
  id?: StoryId;
  source?: string;
  format?: SyntaxHighlighterFormatTypes;
  language?: SupportedLanguage;
  warning?: string;
  previewOnly?: boolean;
};

type LiveSnippet = ReturnType<StoryDocsService['queries']['liveSnippet']['get']>;

export const CodePanel = ({
  active,
  lastEvent,
  currentStoryId,
  storyParameters,
  storyPrepared,
  liveSnippet,
}: {
  active: boolean | undefined;
  lastEvent: SnippetRenderedEvent | undefined;
  currentStoryId: string | undefined;
  storyParameters: StoryDocsCodePanelParameters | undefined;
  storyPrepared: boolean | undefined;
  liveSnippet?: LiveSnippet;
}) => {
  const [codeSnippet, setSourceCode] = useState<SnippetRenderedEvent>(
    lastEvent?.id === currentStoryId ? (lastEvent ?? {}) : {}
  );

  const parameter = useParameter(PARAM_KEY, {
    source: { code: '' } as SourceParameters,
    theme: 'dark',
  });

  useEffect(() => {
    setSourceCode({});
  }, [currentStoryId]);

  useChannel(
    {
      [SNIPPET_RENDERED]: ({ id, source, format, language, warning, previewOnly }) => {
        // Ignore snippets emitted for other stories: a slow extraction for the previously selected
        // story can resolve after navigation and would otherwise overwrite the current panel.
        // `useChannel` captures this handler per `deps`, so it must list `currentStoryId` to compare
        // against the currently selected story rather than the one selected on mount.
        if (id !== undefined && id !== currentStoryId) {
          return;
        }
        setSourceCode({ source, format, language, warning, previewOnly });
      },
    },
    [currentStoryId]
  );

  const theme = useTheme();
  const isDark = theme.base !== 'light';

  // An emit marked `previewOnly` depends on what only the preview has: a
  // `parameters.docs.source.transform` function, or args the channel cannot carry.
  const shown =
    liveSnippet?.snippet !== undefined && !codeSnippet.previewOnly
      ? { source: liveSnippet.snippet, warning: liveSnippet.warning }
      : codeSnippet;

  const awaitingServiceSnippet = shouldWaitForServiceSnippet(storyParameters, storyPrepared);
  const code =
    parameter.source?.code ||
    shown.source ||
    (awaitingServiceSnippet ? '' : parameter.source?.originalSource);
  // The warning describes the shown snippet, so a `docs.source.code` override retires it.
  const warning = parameter.source?.code ? undefined : shown.warning;

  const language =
    parameter.source?.language ??
    (!parameter.source?.code && shown.source ? codeSnippet.language : undefined);

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
        <PositionedSnippetWarning warning={warning} />
      </SourceStyles>
    </AddonPanel>
  );
};

const SourceStyles = styled.div({
  height: '100%',
  position: 'relative',
  [`> :first-child${ignoreSsrWarning}`]: {
    margin: 0,
    height: '100%',
    boxShadow: 'none',
  },
});

const PositionedSnippetWarning = styled(SnippetWarning)({
  position: 'absolute',
  top: 8,
  right: 10,
});
