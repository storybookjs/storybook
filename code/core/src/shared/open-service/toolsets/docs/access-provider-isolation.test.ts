/**
 * Failure isolation and fan-out while expanding a listing's story `$ref`s.
 *
 * A composed listing is assembled from several Storybooks over the network, so one unreachable
 * `$ref` must cost that source its story ids — not its rows, and not the other sources.
 */

import { describe, expect, it } from 'vitest';

import { createProviderDocsAccess } from './access-provider.ts';

const COMPONENTS = JSON.stringify({
  v: 1,
  components: {
    button: { id: 'button', name: 'Button', stories: { $ref: 'services/stories.json#/button' } },
    card: { id: 'card', name: 'Card', stories: { $ref: 'services/stories.json#/card' } },
  },
});

const SOURCE = { id: 'design-system', title: 'Design System', url: 'https://ds.example.com' };

/** Serves the index, and fails every story `$ref` fetch. */
function providerWithBrokenStoryRefs() {
  return async (_request: unknown, path: string) => {
    if (path.endsWith('components.json')) {
      return COMPONENTS;
    }
    if (path.endsWith('docs.json')) {
      return JSON.stringify({ v: 1, docs: {} });
    }
    throw new Error(`unreachable: ${path}`);
  };
}

describe('resolving hostile ids', () => {
  it.each(['constructor', 'toString', 'hasOwnProperty'])(
    'answers absence for the prototype member %s instead of rendering it',
    async (id) => {
      const access = createProviderDocsAccess({ manifestProvider: providerWithBrokenStoryRefs() });

      await expect(access.resolve(id)).resolves.toBeUndefined();
    }
  );
});

describe('expanding story refs', () => {
  it('keeps a composed source listed when its story refs fail', async () => {
    const access = createProviderDocsAccess({
      source: SOURCE,
      manifestProvider: providerWithBrokenStoryRefs(),
    });

    const manifests = await access.list({ withStoryIds: true });

    expect(Object.keys(manifests.componentManifest.components)).toEqual(['button', 'card']);
  });

  it('fails the listing of a single Storybook, which has nothing to fall back on', async () => {
    const access = createProviderDocsAccess({ manifestProvider: providerWithBrokenStoryRefs() });

    await expect(access.list({ withStoryIds: true })).rejects.toThrow();
  });

  it('bounds how many story refs are in flight at once', async () => {
    const total = 60;
    const components = Object.fromEntries(
      Array.from({ length: total }, (_, index) => [
        `c${index}`,
        {
          id: `c${index}`,
          name: `C${index}`,
          stories: { $ref: `services/stories.json#/c${index}` },
        },
      ])
    );

    let inFlight = 0;
    let peak = 0;
    const access = createProviderDocsAccess({
      source: SOURCE,
      manifestProvider: async (_request: unknown, path: string) => {
        if (path.endsWith('components.json')) {
          return JSON.stringify({ v: 1, components });
        }
        if (path.endsWith('docs.json')) {
          return JSON.stringify({ v: 1, docs: {} });
        }
        inFlight += 1;
        peak = Math.max(peak, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 1));
        inFlight -= 1;
        // Every pointer must resolve: a failed ref would reject the whole fan-out after the first
        // wave, and the bound would never be exercised past the initial 16.
        return JSON.stringify(
          Object.fromEntries(
            Array.from({ length: total }, (_, index) => [`c${index}`, { stories: {} }])
          )
        );
      },
    });

    await access.list({ withStoryIds: true });

    expect(peak).toBeLessThanOrEqual(16);
    expect(peak).toBeGreaterThan(1);
  });
});
