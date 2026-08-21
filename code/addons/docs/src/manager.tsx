import React, { useState } from 'react';

import { AddonPanel, type SyntaxHighlighterFormatTypes } from 'storybook/internal/components';

import {
  addons,
  getService,
  types,
  useArgs,
  useChannel,
  useParameter,
  useServiceQuery,
} from 'storybook/manager-api';
import { createDynamicSnippetInput } from 'storybook/open-service';
import { ignoreSsrWarning, styled, useTheme } from 'storybook/theming';

import {
  ADDON_ID,
  isStoryDocsSnippetEligible,
  PANEL_ID,
  PARAM_KEY,
  type StoryDocsCodePanelParameters,
  shouldWaitForServiceSnippet,
  SNIPPET_RENDERED,
} from 'storybook/internal/docs-tools';
import type { StoryId } from 'storybook/internal/types';
import type { SourceParameters } from './blocks/blocks';
import { SnippetWarning } from './blocks/components/SnippetWarning';
import { Source } from './blocks/components/Source';

/** Payload emitted on the `SNIPPET_RENDERED` channel event (see `emitTransformCode`). */
type SnippetRenderedEvent = {
  id?: StoryId;
  source?: string;
  format?: SyntaxHighlighterFormatTypes;
  warning?: string;
};

type CodePanelProps = {
  active: boolean | undefined;
  lastEvent: SnippetRenderedEvent | undefined;
  currentStoryId: string | undefined;
  storyRefId: string | undefined;
  storyParameters: StoryDocsCodePanelParameters | undefined;
  storyPrepared: boolean | undefined;
};

const CodePanelContents = ({
  active,
  source,
  format,
  warning,
  storyRefId,
  storyParameters,
  storyPrepared,
}: {
  active: boolean | undefined;
  source: string | undefined;
  format: SyntaxHighlighterFormatTypes | undefined;
  warning: string | undefined;
  storyRefId: string | undefined;
  storyParameters: StoryDocsCodePanelParameters | undefined;
  storyPrepared: boolean | undefined;
}) => {
  const parameter = useParameter(PARAM_KEY, {
    source: { code: '' } as SourceParameters,
    theme: 'dark',
  });

  const theme = useTheme();
  const isDark = theme.base !== 'light';

  const awaitingServiceSnippet =
    storyRefId === undefined && shouldWaitForServiceSnippet(storyParameters, storyPrepared);
  const code =
    parameter.source?.code ??
    source ??
    (awaitingServiceSnippet ? '' : parameter.source?.originalSource);
  const snippetWarning = parameter.source?.code === undefined ? warning : undefined;

  return (
    <AddonPanel active={!!active}>
      <SourceStyles>
        <Source {...parameter.source} code={code} format={format} dark={isDark} />
        <PositionedSnippetWarning warning={snippetWarning} />
      </SourceStyles>
    </AddonPanel>
  );
};

const ServiceCodePanel = ({
  active,
  currentStoryId,
  storyRefId,
  storyParameters,
  storyPrepared,
}: Omit<CodePanelProps, 'currentStoryId' | 'lastEvent'> & { currentStoryId: string }) => {
  const [args] = useArgs();
  const service = getService('core/dynamic-snippets', { internal: true });
  const { data } = useServiceQuery(
    service.queries.dynamicSnippet,
    createDynamicSnippetInput(currentStoryId, args)
  );

  return (
    <CodePanelContents
      active={active}
      source={data?.transformedSource ?? data?.source}
      format={undefined}
      warning={data?.warning}
      storyRefId={storyRefId}
      storyParameters={storyParameters}
      storyPrepared={storyPrepared}
    />
  );
};

const LegacyCodePanel = ({
  active,
  lastEvent,
  currentStoryId,
  storyRefId,
  storyParameters,
  storyPrepared,
}: CodePanelProps) => {
  const lastEventMatchesCurrentStory = lastEvent?.id === currentStoryId;
  const [codeSnippet, setSourceCode] = useState<{
    source: string | undefined;
    format: SyntaxHighlighterFormatTypes | undefined;
    warning: string | undefined;
  }>({
    source: lastEventMatchesCurrentStory ? lastEvent?.source : undefined,
    format: lastEventMatchesCurrentStory ? (lastEvent?.format ?? undefined) : undefined,
    warning: lastEventMatchesCurrentStory ? lastEvent?.warning : undefined,
  });

  useChannel(
    {
      [SNIPPET_RENDERED]: ({ id, source, format, warning }) => {
        // Ignore snippets emitted for other stories: a slow extraction for the previously selected
        // story can resolve after navigation and would otherwise overwrite the current panel.
        // `useChannel` captures this handler per `deps`, so it must list `currentStoryId` to compare
        // against the currently selected story rather than the one selected on mount.
        if (id !== undefined && id !== currentStoryId) {
          return;
        }
        setSourceCode({ source, format, warning });
      },
    },
    [currentStoryId]
  );

  return (
    <CodePanelContents
      active={active}
      source={codeSnippet.source}
      format={codeSnippet.format}
      warning={codeSnippet.warning}
      storyRefId={storyRefId}
      storyParameters={storyParameters}
      storyPrepared={storyPrepared}
    />
  );
};

const CodePanel = ({ currentStoryId, lastEvent, ...panelProps }: CodePanelProps) => {
  if (
    globalThis.FEATURES?.experimentalDocgenServer &&
    panelProps.storyPrepared &&
    panelProps.storyRefId === undefined &&
    currentStoryId &&
    isStoryDocsSnippetEligible(panelProps.storyParameters)
  ) {
    return <ServiceCodePanel {...panelProps} currentStoryId={currentStoryId} />;
  }

  return <LegacyCodePanel {...panelProps} currentStoryId={currentStoryId} lastEvent={lastEvent} />;
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
          key={`${currentStory?.refId ?? ''}:${currentStory?.id ?? ''}`}
          currentStoryId={currentStory?.id}
          storyRefId={currentStory?.refId}
          storyParameters={currentStory?.parameters}
          storyPrepared={currentStory?.prepared}
          lastEvent={lastEvent}
          active={active}
        />
      );
    },
  });
});

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
