import { once } from 'storybook/internal/client-logger';
import type { CleanupCallback } from 'storybook/internal/csf';
import type { StoryContext } from 'storybook/internal/types';
import { shouldSkipStoryDocsEmit } from '../../../../docs-tools/storyDocsCodePanel.ts';

import { emitTransformCode, getService } from 'storybook/preview-api';

import type { SnippetTemplateRenderer } from './snippet.ts';
import { selectSnippetForStory } from './snippet.ts';

export { shouldSkipStoryDocsEmit };

/**
 * Preview `beforeEach` hook that emits the story-docs snippet to the manager Code panel via
 * {@link emitTransformCode}.
 *
 * `emitTransformCode` broadcasts `SNIPPET_RENDERED`, which the docs `SourceContainer` also stores
 * and the `Source` block reads back, so this hook feeds both consumers rather than only the panel.
 *
 * Runs on every story invocation, which includes every args change, so passing the context's args
 * through is what makes the snippet track the Controls.
 */
export function storyDocsSourceBeforeEach(context: StoryContext): CleanupCallback | void {
  if (!globalThis.FEATURES?.experimentalDocgenServer) {
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
      const snippet = selectSnippetForStory(
        payload,
        storyId,
        context.unmappedArgs,
        context.parameters?.docs?.source?.renderSnippetTemplate as SnippetTemplateRenderer
      );
      const source = snippet ?? context.parameters?.docs?.source?.originalSource;
      if (source === undefined) {
        return;
      }
      return emitTransformCode(source, context);
    })
    .catch((error) => {
      once.warn(`Could not load code snippets for "${componentId}": ${String(error)}`);
      const fallback = context.parameters?.docs?.source?.originalSource;
      if (cancelled || fallback === undefined) {
        return;
      }
      return emitTransformCode(fallback, context);
    });

  return () => {
    cancelled = true;
    return codePanelSnippetPromise;
  };
}
