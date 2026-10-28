import { logger } from '@storybook/core/internal/client-logger';
import type { CleanupCallback } from '../../../../csf/index.ts';
import type { StoryContext } from '@storybook/core/internal/types';
import { shouldSkipStoryDocsEmit } from '../../../../docs-tools/storyDocsCodePanel.ts';

import { emitTransformCode, getService } from '@storybook/core/preview-api';

import { getFeatures } from '../../../features.ts';
import { selectSnippetForStory, selectWarningForStory } from './snippet.ts';

export { shouldSkipStoryDocsEmit };

/**
 * Preview `beforeEach` hook that emits a static story-docs snippet to the manager Code panel via
 * {@link emitTransformCode}. Runs once per story invocation; the snippet itself is static.
 */
export function storyDocsSourceBeforeEach(context: StoryContext): CleanupCallback | void {
  if (!getFeatures().docgenServer) {
    return;
  }
  if (shouldSkipStoryDocsEmit(context.parameters)) {
    return;
  }

  const service = (() => {
    try {
      return getService('core/story-docs', { internal: true });
    } catch {
      return undefined;
    }
  })();
  if (!service) {
    return;
  }

  const storyId = context.id;
  const componentId = storyId.split('--')[0]!;
  let cancelled = false;

  // Do not await story-docs I/O here — story render should start immediately. Cleanup flips
  // `cancelled` so a slow load cannot emit after the story is torn down, then returns the chain
  // so navigation waits for in-flight work to settle.
  const codePanelSnippetPromise = service.queries.storyDocs
    .loaded({ id: componentId })
    .then((payload) => {
      if (cancelled) {
        return;
      }
      const snippet = selectSnippetForStory(payload, storyId);
      const source = snippet ?? context.parameters?.docs?.source?.originalSource;
      if (source === undefined) {
        return;
      }
      const warning = selectWarningForStory(payload, storyId);

      return emitTransformCode(
        source,
        context,
        snippet === undefined && warning ? `${warning} Showing the story source instead.` : warning
      );
    })
    // The snippet is a Code panel nicety; a failed load must not surface as an unhandled rejection
    // that fails the story's play function.
    .catch((error: unknown) => {
      logger.debug(`Story docs snippet for ${storyId} unavailable: ${String(error)}`);
    });

  return () => {
    cancelled = true;
    return codePanelSnippetPromise;
  };
}
