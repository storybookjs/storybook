import React, { useEffect } from 'react';

import { logger } from 'storybook/internal/client-logger';
import {
  ADDON_ID,
  PANEL_ID,
  PARAM_KEY,
  SNIPPET_RENDERED,
  shouldSkipStoryDocsEmit,
} from 'storybook/internal/docs-tools';
import { argChanges } from 'storybook/internal/docs-tools/snippets';
import type { API_LeafEntry } from 'storybook/internal/types';
import { addons, getService, types, useServiceQuery } from 'storybook/manager-api';

import { CodePanel } from './CodePanel.tsx';

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
    ...argChanges({
      unmappedArgs: (story?.type === 'story' && story.args) || {},
      initialArgs: (story?.type === 'story' && story.initialArgs) || {},
    }),
  });

  return <CodePanel {...props} liveSnippet={isStory ? data : undefined} />;
};

addons.register(ADDON_ID, (api) => {
  addons.add(PANEL_ID, {
    title: 'Code',
    type: types.PANEL,
    paramKey: PARAM_KEY,
    disabled: (parameters) => parameters?.docs?.codePanel === false,
    match: ({ viewMode }) => viewMode === 'story',
    render: ({ active }) => {
      const channel = api.getChannel();
      const currentStory = api.getCurrentStoryData();
      const props = {
        currentStoryId: currentStory?.id,
        storyParameters: currentStory?.parameters,
        storyPrepared: currentStory?.prepared,
        lastEvent: channel?.last(SNIPPET_RENDERED)?.[0],
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
