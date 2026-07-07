import { shouldSkipStoryDocsEmit } from '../../../../docs-tools/storyDocsCodePanel.ts';
import type { CleanupCallback } from 'storybook/internal/csf';
import type { StoryContext } from 'storybook/internal/types';

import { emitTransformCode, getService } from 'storybook/preview-api';

import { selectSnippetForStory } from './snippet.ts';

export { shouldSkipStoryDocsEmit };

/**
 * Preview `beforeEach` hook that emits a static story-docs snippet to the manager Code panel via
 * {@link emitTransformCode}. Runs once per story invocation; the snippet itself is static.
 */
export function storyDocsSourceBeforeEach(context: StoryContext): CleanupCallback | void {
  if (!globalThis.FEATURES?.experimentalDocgenServer) {
    return;
  }
  // Portable stories (vitest, playwright/jest portable) have no manager Code panel and no OSA
  // server peer, so the `extractStoryDocs` remote command has no handler and would reject after
  // the remote-command ack timeout. There is nothing to emit to, so skip entirely.
  if (context.parameters?.__isPortableStory) {
    return;
  }
  if (shouldSkipStoryDocsEmit(context.parameters)) {
    return;
  }

  const service = (() => {
    try {
      return getService('core/story-docs');
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
      return emitTransformCode(source, context);
    })
    // Never let a failed/unbacked remote command surface as an unhandled rejection through the
    // cleanup chain (e.g. environments with no OSA server peer).
    .catch(() => undefined);

  return () => {
    cancelled = true;
    return codePanelSnippetPromise;
  };
}
