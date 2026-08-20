import type { StoryContext } from 'storybook/internal/types';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { emitTransformCode } from 'storybook/preview-api';

import { registerService } from '../../preview.ts';
import { clearRegistry } from '../../service-registry.ts';
import { storyDocsServiceDef } from './definition.ts';
import { storyDocsSourceBeforeEach } from './story-docs-source-before-each.ts';
import type { StoryDocsPayload } from './types.ts';

vi.mock('storybook/preview-api', { spy: true });

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
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// A static build has no server to extract from: the preview subscribes with an empty state and the
// snapshot arrives over `fetch` afterwards. The snippet only reaches the Code panel and the docs
// Source block if that arrival re-emits, so this covers the whole static path rather than the query.
describe('story-docs snippets in a static build', () => {
  it('emits the fetched snippet instead of the raw CSF fallback', async () => {
    vi.stubGlobal('CONFIG_TYPE', 'PRODUCTION');
    vi.stubGlobal('FEATURES', { experimentalDocgenServer: true });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        expect(url).toBe('./services/core/story-docs/button.json');
        return { ok: true, status: 200, json: async () => ({ components: { button: payload } }) };
      })
    );

    registerService(storyDocsServiceDef);

    const cleanup = storyDocsSourceBeforeEach({
      id: storyId,
      unmappedArgs: { label: 'declaredLabel' },
      parameters: {
        __isArgsStory: true,
        docs: { source: { originalSource: "{ args: { label: 'declaredLabel' } }" } },
      },
    } as unknown as StoryContext);

    await vi.waitFor(() => expect(emitTransformCode).toHaveBeenCalled());
    await (cleanup as () => Promise<void>)();

    expect(vi.mocked(emitTransformCode).mock.calls.at(-1)?.[0]).toBe(snippet);
  });
});
