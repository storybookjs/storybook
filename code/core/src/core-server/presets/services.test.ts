import type { Options } from 'storybook/internal/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ToolsetCtx } from '../../shared/open-service/toolset-definition.ts';
import { clearToolsetRegistry, getToolset } from '../../shared/open-service/toolset-registry.ts';
import { loadManifests } from '../utils/manifests/manifests.ts';
import { services } from './common-preset.ts';

vi.mock('../utils/manifests/manifests.ts', { spy: true });

const REMOTE_MANIFEST = JSON.stringify({
  v: 1,
  components: { button: { id: 'button', name: 'Button', path: 'src/Button.tsx' } },
});

const cliCtx: ToolsetCtx = { transport: 'cli', getService: () => ({}) as never };

function optionsWithRefs(refs: unknown): Options {
  return {
    channel: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
    presets: {
      apply: async (extension: string, config?: unknown) => {
        switch (extension) {
          case 'refs':
            return refs;
          case 'features':
            return {};
          default:
            return config;
        }
      },
    },
  } as unknown as Options;
}

function jsonResponse(status: number, body?: string) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Not Found',
    headers: new Headers({ 'content-type': 'application/json' }),
    text: async () => body ?? '',
  };
}

// Serves only the ref's components manifest; anything else is a 404, like a static host.
function fetchServing(manifestUrl: string) {
  return vi.fn(async (url: string | URL) =>
    String(url) === manifestUrl ? jsonResponse(200, REMOTE_MANIFEST) : jsonResponse(404)
  );
}

const RESHAPED = { reshaped: { title: 'Reshaped', url: 'https://reshaped.example.com/' } };
const RESHAPED_MANIFEST_URL = 'https://reshaped.example.com/manifests/components.json';

describe('services preset hook: docs toolset', () => {
  beforeEach(() => {
    clearToolsetRegistry();
    vi.stubGlobal('STORYBOOK_SERVICES_LOADED', false);
    vi.mocked(loadManifests).mockResolvedValue({
      components: {
        v: 0,
        components: {
          card: { id: 'card', name: 'Card', path: './Card.tsx', jsDocTags: {}, stories: [] },
        },
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('with refs', () => {
    it('lists the local Storybook and every composed ref under its own heading', async () => {
      const fetch = fetchServing(RESHAPED_MANIFEST_URL);
      vi.stubGlobal('fetch', fetch);

      await services(undefined, optionsWithRefs(RESHAPED));
      expect(fetch).not.toHaveBeenCalled();

      const outcome = await getToolset('docs').methods.list.handler({ withStoryIds: false });

      expect(outcome.markdown).toContain('# Local');
      expect(outcome.markdown).toContain('id: local');
      expect(outcome.markdown).toContain('card');
      expect(outcome.markdown).toContain('# Reshaped');
      expect(outcome.markdown).toContain('id: reshaped');
      expect(outcome.markdown).toContain('button');
      expect(outcome.telemetry?.payload).toMatchObject({ sourceCount: 2 });
      expect(fetch).toHaveBeenCalledWith(RESHAPED_MANIFEST_URL, {
        signal: expect.any(AbortSignal),
      });
    });

    it('requires a storybookId on show and answers a missing one with the available sources', async () => {
      vi.stubGlobal('fetch', fetchServing(RESHAPED_MANIFEST_URL));

      await services(undefined, optionsWithRefs(RESHAPED));
      const { show, showStory } = getToolset('docs').methods;

      expect(show.input.entries).toHaveProperty('storybookId');
      expect(showStory.input.entries).toHaveProperty('storybookId');

      const missing = await show.handler({ id: 'button' } as never, cliCtx);
      expect(missing.ok).toBe(false);
      expect(missing.markdown).toContain(
        'storybookId is required. Available sources: local, reshaped'
      );

      const unknown = await show.handler({ id: 'button', storybookId: 'nope' } as never, cliCtx);
      expect(unknown.ok).toBe(false);
      expect(unknown.markdown).toContain('Storybook source not found: "nope"');

      const found = await show.handler({ id: 'button', storybookId: 'reshaped' } as never, cliCtx);
      expect(found.ok).toBe(true);
      expect(found.markdown).toContain('Button');
    });

    it('keeps the local section and reports a ref without a manifest in its own error section', async () => {
      vi.stubGlobal(
        'fetch',
        fetchServing('https://elsewhere.example.com/manifests/components.json')
      );

      await services(undefined, optionsWithRefs(RESHAPED));
      const outcome = await getToolset('docs').methods.list.handler({ withStoryIds: false });

      expect(outcome.markdown).toContain('card');
      expect(outcome.markdown).toMatch(/# Reshaped\nid: reshaped\n\nerror: .*404/);
      expect(outcome.markdown).toContain('componentsManifest');
    });

    it('keeps the local section when a ref is unreachable', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));

      await services(undefined, optionsWithRefs(RESHAPED));
      const outcome = await getToolset('docs').methods.list.handler({ withStoryIds: false });

      expect(outcome.markdown).toContain('card');
      expect(outcome.markdown).toMatch(/# Reshaped\nid: reshaped\n\nerror: .*ECONNREFUSED/);
    });
  });

  describe('without refs', () => {
    it('registers a single-source toolset whose show takes only an id', async () => {
      const fetch = vi.fn();
      vi.stubGlobal('fetch', fetch);

      await services(undefined, optionsWithRefs({}));
      const { list, show } = getToolset('docs').methods;

      expect(show.input.entries).not.toHaveProperty('storybookId');

      const outcome = await list.handler({ withStoryIds: false });
      expect(outcome.markdown).toContain('card');
      expect(outcome.markdown).not.toContain('# Local');
      expect(fetch).not.toHaveBeenCalled();
    });
  });
});
