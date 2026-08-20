import React, { useState } from 'react';

import { AddonPanel, type SyntaxHighlighterFormatTypes } from 'storybook/internal/components';

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
  const [receivedEvent, setReceivedEvent] = useState<SnippetRenderedEvent | undefined>(undefined);

  const parameter = useParameter(PARAM_KEY, {
    source: { code: '' } as SourceParameters,
    theme: 'dark',
  });

  // Stored unfiltered: a snippet can be emitted before the manager knows which story is selected,
  // so an event that does not match yet may still be the one for the story about to be shown.
  useChannel({ [SNIPPET_RENDERED]: (event: SnippetRenderedEvent) => setReceivedEvent(event) }, []);

  const theme = useTheme();
  const isDark = theme.base !== 'light';

  // The panel mounts when the story is selected, which can be after the preview already emitted its
  // snippet, so the channel's last event stands in for the emit this panel was not there to hear.
  // Both are matched against the selected story: a slow extraction for the previously selected one
  // can resolve after navigation and must not show up under the story that replaced it.
  const codeSnippet = [receivedEvent, lastEvent].find(
    (event) => event !== undefined && (event.id === undefined || event.id === currentStoryId)
  );

  const awaitingServiceSnippet = shouldWaitForServiceSnippet(storyParameters, storyPrepared);
  const code =
    parameter.source?.code ||
    codeSnippet?.source ||
    (awaitingServiceSnippet ? '' : parameter.source?.originalSource);

  return (
    <AddonPanel active={!!active}>
      <SourceStyles>
        <Source {...parameter.source} code={code} format={codeSnippet?.format} dark={isDark} />
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
