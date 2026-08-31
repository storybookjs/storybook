/**
 * Selection contract for the local docs access: which engine serves is decided by whether the
 * docgen services actually registered, never by the feature flag alone. Composed and uncomposed
 * consumers share this helper, so this is the single place the choice is pinned.
 */

import type { StoryIndex } from 'storybook/internal/types';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createLocalDocsAccess } from './access-local.ts';
import type { RawManifests } from './access-manifest.ts';

const getRegisteredServices = vi.hoisted(() => vi.fn<() => Array<{ id: string }>>(() => []));
const getService = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error('read from the docgen services');
  })
);
vi.mock('../../service-registry.ts', () => ({ getRegisteredServices, getService }));

const manifests: RawManifests = {
  components: {
    v: 0,
    components: { button: { id: 'button', name: 'Button' } },
    meta: { docgen: 'react-docgen', durationMs: 1 },
  },
};

const emptyIndex = { v: 5, entries: {} } as StoryIndex;

const createAccess = () =>
  createLocalDocsAccess({
    storyIndex: { getIndex: async () => emptyIndex },
    getManifests: async () => manifests,
  });

beforeEach(() => {
  getRegisteredServices.mockReturnValue([]);
});

describe('createLocalDocsAccess', () => {
  it('serves from the inline manifests when the docgen services never registered', async () => {
    const listing = await createAccess().list({ withStoryIds: false });

    expect(Object.keys(listing.componentManifest.components)).toEqual(['button']);
    expect(getService).not.toHaveBeenCalled();
  });

  it('serves from the open services once the docgen services registered', async () => {
    getRegisteredServices.mockReturnValue([{ id: 'core/docgen' }, { id: 'core/story-docs' }]);

    await expect(createAccess().list({ withStoryIds: false })).rejects.toThrow(
      'read from the docgen services'
    );
  });

  it('falls back to the inline manifests when docgen registered without story-docs', async () => {
    getRegisteredServices.mockReturnValue([{ id: 'core/docgen' }]);

    const listing = await createAccess().list({ withStoryIds: false });

    expect(Object.keys(listing.componentManifest.components)).toEqual(['button']);
    expect(getService).not.toHaveBeenCalled();
  });

  it('probes per call, because it can be created before the services preset hooks run', async () => {
    const access = createAccess();

    await expect(access.list({ withStoryIds: false })).resolves.toBeDefined();

    getRegisteredServices.mockReturnValue([{ id: 'core/docgen' }, { id: 'core/story-docs' }]);
    await expect(access.list({ withStoryIds: false })).rejects.toThrow(
      'read from the docgen services'
    );
  });
});
