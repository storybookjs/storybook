import type { StoryContext } from 'storybook/internal/types';
import type { ModuleExport, StoryDocsPayload } from 'storybook/internal/types';
import type { StoryDocsService } from 'storybook/open-service';
import * as previewApi from 'storybook/preview-api';
import { vi } from 'vitest';

import type { DocsContextProps } from './DocsContext';

export function createMockStoryDocsService(
  payloads: Record<string, StoryDocsPayload>
): StoryDocsService {
  const getStoryDocs = Object.assign(({ id }: { id: string }) => payloads[id], {
    subscribe: (
      input: { id: string },
      selector: (payload: StoryDocsPayload | undefined) => unknown,
      listener: (value: unknown) => void
    ) => {
      listener(selector(payloads[input.id]));
      return () => {};
    },
    loaded: (input: { id: string }) => Promise.resolve(payloads[input.id]),
  });

  return { queries: { getStoryDocs } } as StoryDocsService;
}

export type StoryDocsMockData = {
  description?: string;
  snippet?: string;
  import?: string;
};

export function mockStoryDocsServiceForOf(
  docsContext: DocsContextProps,
  of: ModuleExport,
  data: StoryDocsMockData
) {
  const { story } = docsContext.resolveOf(of, ['story']);
  const componentId = story.id.split('--')[0]!;

  vi.mocked(previewApi.getService).mockImplementation((serviceId) => {
    if (serviceId === 'core/story-docs') {
      return createMockStoryDocsService({
        [componentId]: {
          id: componentId,
          name: componentId,
          path: './example.stories.tsx',
          ...(data.import ? { import: data.import } : {}),
          stories: {
            [story.id]: {
              id: story.id,
              name: story.name,
              ...(data.description ? { description: data.description } : {}),
              ...(data.snippet ? { snippet: data.snippet } : {}),
            },
          },
        },
      });
    }
    throw new Error(`Unexpected getService(${serviceId})`);
  });
}

export function storyDocsServiceStoryBeforeEach(of: ModuleExport, data: StoryDocsMockData) {
  return async (context: StoryContext) => {
    const docsContext = context.loaded?.docsContext as DocsContextProps | undefined;
    if (!docsContext) {
      throw new Error('docsContext is required to mock story-docs for docs block stories');
    }

    mockStoryDocsServiceForOf(docsContext, of, data);

    return () => {
      vi.mocked(previewApi.getService).mockRestore();
    };
  };
}
