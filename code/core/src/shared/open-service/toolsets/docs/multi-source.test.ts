/**
 * How a composition picks the access for each of its sources.
 *
 * The local Storybook is a source like any other, but it is the one this process can read directly.
 * These tests pin that routing, so a composition cannot quietly grow a second way of reading the
 * Storybook it is already serving.
 */

import { describe, expect, it, vi } from 'vitest';

import type { DocsAccess } from './access.ts';
import { createCompositionDocsSources } from './multi-source.ts';

const LOCAL = { id: 'local', title: 'Local' };
const REMOTE = { id: 'design-system', title: 'Design System', url: 'https://ds.example.com' };

/** Serves a minimal but valid pair of manifests, whatever path is asked for. */
function providerStub() {
  return vi.fn(async (_request: unknown, path: string) =>
    path.endsWith('docs.json')
      ? '{"v":1,"docs":{}}'
      : '{"v":1,"components":{"a":{"id":"a","name":"A"}}}'
  );
}

function accessStub(): DocsAccess {
  return {
    list: vi.fn().mockResolvedValue({ componentManifest: { v: 1, components: {} } }),
    resolve: vi.fn().mockResolvedValue(undefined),
  };
}

describe('createCompositionDocsSources', () => {
  it('reads the local source through the access it was given', async () => {
    const localAccess = accessStub();
    const manifestProvider = vi.fn();

    const [local] = createCompositionDocsSources({
      sources: [LOCAL],
      localAccess,
      manifestProvider,
    });

    await local!.access.list({ withStoryIds: false });

    expect(localAccess.list).toHaveBeenCalled();
    expect(manifestProvider).not.toHaveBeenCalled();
  });

  it('still fetches remote sources over the provider when a local access is given', async () => {
    const localAccess = accessStub();
    const manifestProvider = providerStub();

    const sources = createCompositionDocsSources({
      sources: [LOCAL, REMOTE],
      localAccess,
      manifestProvider,
    });
    const remote = sources.find(({ source }) => source.id === REMOTE.id)!;

    await remote.access.list({ withStoryIds: false });

    expect(manifestProvider).toHaveBeenCalled();
    expect(localAccess.list).not.toHaveBeenCalled();
  });

  it('falls back to the provider for the local source when no access is given', async () => {
    const manifestProvider = providerStub();

    const [local] = createCompositionDocsSources({ sources: [LOCAL], manifestProvider });
    await local!.access.list({ withStoryIds: false });

    expect(manifestProvider).toHaveBeenCalled();
  });
});
