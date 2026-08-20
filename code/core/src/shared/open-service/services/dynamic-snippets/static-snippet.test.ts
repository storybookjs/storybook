import { afterEach, describe, expect, it, vi } from 'vitest';

import { createTestChannel, installTestChannel } from '../../../../channels/test-channel.ts';
import { clearRegistry } from '../../service-registry.ts';
import { registerStoryDocsPreviewService } from '../story-docs/preview.ts';
import type { StoryDocsPayload } from '../story-docs/types.ts';
import { createDynamicSnippetInput } from './dynamic-snippet.ts';
import { registerDynamicSnippetPreviewService } from './preview.ts';

const storyId = 'button--primary';
const snippet = '<sb-button [label]="\'declaredLabel\'" />';
const payload: StoryDocsPayload = {
  id: 'button',
  name: 'Button',
  path: './button.stories.ts',
  stories: { [storyId]: { id: storyId, name: 'Primary', snippet } },
};

afterEach(() => {
  clearRegistry();
  installTestChannel(null);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('dynamic snippets in a static build', () => {
  it('renders a record from the fetched StoryDocs snapshot', async () => {
    installTestChannel(createTestChannel());
    vi.stubGlobal('CONFIG_TYPE', 'PRODUCTION');
    const fetchStoryDocs = vi
      .fn()
      .mockImplementationOnce(async (url: string) => {
        expect(url).toBe('./services/core/story-docs/button.json');
        return { ok: true, status: 200, json: async () => ({ components: { button: payload } }) };
      })
      .mockRejectedValue(new Error('transient fetch failure'));
    vi.stubGlobal('fetch', fetchStoryDocs);
    vi.stubGlobal('__STORYBOOK_PREVIEW__', {
      loadStory: vi.fn(async () => ({ id: storyId })),
      getStoryContext: vi.fn(() => ({
        unmappedArgs: { label: 'declaredLabel' },
        parameters: {
          docs: { source: { originalSource: "{ args: { label: 'declaredLabel' } }" } },
        },
      })),
    });

    registerStoryDocsPreviewService();
    const service = registerDynamicSnippetPreviewService();
    const input = createDynamicSnippetInput(storyId, { label: 'declaredLabel' });
    const record = await service.queries.dynamicSnippet.loaded(input);

    expect(record).toMatchObject({ source: snippet });
    expect(record?.transformedSource).toBeUndefined();

    const refreshed = await service.commands.renderDynamicSnippet(input);

    expect(refreshed).toEqual(record);
    expect(fetchStoryDocs).toHaveBeenCalledOnce();
  });
});
