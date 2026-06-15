import { SourceType } from 'storybook/internal/docs-tools';
import type { CleanupCallback } from 'storybook/internal/csf';
import type { StoryContext } from 'storybook/internal/types';

import type { StoryDocsService } from 'storybook/open-service';
import { emitTransformCode, getService } from 'storybook/preview-api';

import { selectSnippetForStory } from './snippet.ts';

/**
 * Whether the story-docs source hook should skip emitting to the Code panel.
 *
 * Mirrors {@link skipJsxRender} in the React `jsxDecorator` so static service snippets replace
 * dynamic JSX rendering under the same conditions.
 */
export function shouldSkipStoryDocsEmit(context: StoryContext): boolean {
  const sourceParams = context.parameters?.docs?.source;
  const isArgsStory = context.parameters?.__isArgsStory;

  if (sourceParams?.type === SourceType.DYNAMIC) {
    return false;
  }

  return !isArgsStory || sourceParams?.code !== undefined || sourceParams?.type === SourceType.CODE;
}

/**
 * Preview `beforeEach` hook that emits a static story-docs snippet to the manager Code panel via
 * {@link emitTransformCode}. Runs once per story invocation; the snippet itself is static.
 */
export function storyDocsSourceBeforeEach(context: StoryContext): CleanupCallback | void {
  if (!globalThis.FEATURES?.experimentalDocgenServer) {
    return;
  }
  if (shouldSkipStoryDocsEmit(context)) {
    return;
  }

  let service: StoryDocsService;
  try {
    service = getService<StoryDocsService>('core/story-docs');
  } catch {
    return;
  }

  const storyId = context.id;
  const componentId = storyId.split('--')[0]!;
  let cancelled = false;

  // Do not await story-docs I/O here — story render should start immediately. Cleanup flips
  // `cancelled` so a slow load cannot emit after the story is torn down, then returns the chain
  // so navigation waits for in-flight work to settle.
  const codePanelSnippetPromise = service.queries.getStoryDocs
    .loaded({ id: componentId })
    .then((payload) => {
      if (cancelled) {
        return;
      }
      const snippet = selectSnippetForStory(payload, storyId);
      if (snippet === undefined) {
        return;
      }
      return emitTransformCode(snippet, context);
    });

  return () => {
    cancelled = true;
    return codePanelSnippetPromise;
  };
}
