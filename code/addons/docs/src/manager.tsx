import React, { useEffect, useSyncExternalStore } from 'react';

import { logger } from 'storybook/internal/client-logger';
import { AddonPanel, type SyntaxHighlighterFormatTypes } from 'storybook/internal/components';

import {
  type API,
  addons,
  getService,
  types,
  useParameter,
  useServiceQuery,
} from 'storybook/manager-api';
import { ignoreSsrWarning, styled, useTheme } from 'storybook/theming/emotion';

import {
  ADDON_ID,
  PANEL_ID,
  PARAM_KEY,
  type StoryDocsCodePanelParameters,
  shouldSkipStoryDocsEmit,
  shouldWaitForServiceSnippet,
  SNIPPET_RENDERED,
} from 'storybook/internal/docs-tools';
import type { API_LeafEntry, StoryId } from 'storybook/internal/types';
import type { StoryDocsService } from 'storybook/open-service';
import type { SourceParameters } from './blocks/blocks';
import { SnippetWarning } from './blocks/components/SnippetWarning';
import { Source } from './blocks/components/Source';

/** Payload emitted on the `SNIPPET_RENDERED` channel event (see `emitTransformCode`). */
type SnippetRenderedEvent = {
  id?: StoryId;
  source?: string;
  format?: SyntaxHighlighterFormatTypes;
  warning?: string;
  previewOnly?: boolean;
};

type LiveSnippet = ReturnType<StoryDocsService['queries']['liveSnippet']['get']>;

// The preview's latest emit for each story, from the start of the manager on, so the panel shows it
// however late it mounts and whichever story it switches to.
const emits = new Map<StoryId, SnippetRenderedEvent>();
const emitListeners = new Set<() => void>();

const subscribeToEmits = (listener: () => void) => {
  emitListeners.add(listener);
  return () => {
    emitListeners.delete(listener);
  };
};

// An emit without an id is for the story shown when it arrives.
const storeEmit = (api: API, event: SnippetRenderedEvent | undefined) => {
  const id = event && (event.id ?? api.getCurrentStoryData()?.id);
  if (event && id !== undefined) {
    emits.set(id, event);
    emitListeners.forEach((listener) => listener());
  }
};

const CodePanel = ({
  active,
  currentStoryId,
  storyParameters,
  storyPrepared,
  liveSnippet,
}: {
  active: boolean | undefined;
  currentStoryId: string | undefined;
  storyParameters: StoryDocsCodePanelParameters | undefined;
  storyPrepared: boolean | undefined;
  liveSnippet?: LiveSnippet;
}) => {
  const emit = useSyncExternalStore(subscribeToEmits, () =>
    currentStoryId === undefined ? undefined : emits.get(currentStoryId)
  );

  const parameter = useParameter(PARAM_KEY, {
    source: { code: '' } as SourceParameters,
    theme: 'dark',
  });

  const theme = useTheme();
  const isDark = theme.base !== 'light';

  // An emit marked `previewOnly` depends on what only the preview has: a
  // `parameters.docs.source.transform` function, or args the channel cannot carry.
  const shown =
    liveSnippet?.snippet !== undefined && !emit?.previewOnly
      ? { source: liveSnippet.snippet, warning: liveSnippet.warning }
      : { source: emit?.source, warning: emit?.warning };

  const awaitingServiceSnippet = shouldWaitForServiceSnippet(storyParameters, storyPrepared);
  const code =
    parameter.source?.code ||
    shown.source ||
    (awaitingServiceSnippet ? '' : parameter.source?.originalSource);
  // The warning describes the shown snippet, so a `docs.source.code` override retires it.
  const warning = parameter.source?.code ? undefined : shown.warning;

  return (
    <AddonPanel active={!!active}>
      <SourceStyles>
        <Source {...parameter.source} code={code} format={emit?.format} dark={isDark} />
        <PositionedSnippetWarning warning={warning} />
      </SourceStyles>
    </AddonPanel>
  );
};

const LiveSnippetCodePanel = ({
  story,
  ...props
}: Omit<Parameters<typeof CodePanel>[0], 'liveSnippet'> & { story: API_LeafEntry | undefined }) => {
  const service = getService('core/story-docs', { internal: true });
  // A story of a composed Storybook has its story docs in that Storybook.
  const isStory =
    story?.type === 'story' && !story.refId && !shouldSkipStoryDocsEmit(story.parameters);
  const componentId = isStory ? story.id.split('--')[0] : undefined;

  // Loads only missing story docs: in dev the server's story docs sync to the manager, and a load
  // would extract them again. Static story docs do not sync, so there the manager fetches its own.
  useEffect(() => {
    if (componentId === undefined || service.queries.storyDocs.get({ id: componentId })) {
      return;
    }
    service.queries.storyDocs.loaded({ id: componentId }).catch((error: unknown) => {
      logger.debug(`Story docs of ${componentId} unavailable: ${String(error)}`);
    });
  }, [service, componentId]);

  const { data } = useServiceQuery(service.queries.liveSnippet, {
    storyId: story?.id ?? '',
    args: (story?.type === 'story' && story.args) || {},
    initialArgs: (story?.type === 'story' && story.initialArgs) || {},
  });

  return <CodePanel {...props} liveSnippet={isStory ? data : undefined} />;
};

addons.register(ADDON_ID, (api) => {
  const channel = api.getChannel();
  storeEmit(api, channel?.last(SNIPPET_RENDERED)?.[0]);
  channel?.on(SNIPPET_RENDERED, (event: SnippetRenderedEvent) => storeEmit(api, event));

  addons.add(PANEL_ID, {
    title: 'Code',
    type: types.PANEL,
    paramKey: PARAM_KEY,
    disabled: (parameters) => parameters?.docs?.codePanel === false,
    match: ({ viewMode }) => viewMode === 'story',
    render: ({ active }) => {
      const currentStory = api.getCurrentStoryData();
      const props = {
        currentStoryId: currentStory?.id,
        storyParameters: currentStory?.parameters,
        storyPrepared: currentStory?.prepared,
        active,
      };

      return globalThis.FEATURES?.docgenServer &&
        globalThis.FEATURES.experimentalLiveServerSnippets ? (
        <LiveSnippetCodePanel {...props} story={currentStory} />
      ) : (
        <CodePanel {...props} />
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
