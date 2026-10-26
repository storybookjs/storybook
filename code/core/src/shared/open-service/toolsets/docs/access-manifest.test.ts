import { describe, expect, it, vi } from 'vitest';

import { createManifestDocsAccess, type RawManifests } from './access-manifest.ts';

const button = {
  id: 'button',
  name: 'Button',
  summary: 'A button',
  stories: [{ id: 'button--primary', name: 'Primary', snippet: '<Button />' }],
  docs: { 'button--docs': { id: 'button--docs', name: 'Button docs', content: '# Button' } },
};

const guide = {
  id: 'guide--docs',
  name: 'Guide',
  title: 'Getting started',
  content: '# Guide',
  summary: 'Intro',
};

const inlineManifests: RawManifests = {
  components: { v: 0, components: { button }, meta: { docgen: 'react-docgen', durationMs: 1 } },
  docs: { v: 0, docs: { 'guide--docs': guide } },
};

const createAccess = (manifests: RawManifests = inlineManifests) =>
  createManifestDocsAccess({ getManifests: async () => manifests });

describe('createManifestDocsAccess list', () => {
  it('returns the inline manifests as the shared listing shape', async () => {
    const manifests = await createAccess().list({ withStoryIds: true });

    expect(manifests.componentManifest.v).toBe(0);
    expect(manifests.componentManifest.components.button).toEqual(button);
    expect(manifests.docsManifest).toEqual({ v: 0, docs: { 'guide--docs': guide } });
  });

  it('drops inline stories when story ids were not requested', async () => {
    const manifests = await createAccess().list({ withStoryIds: false });

    expect(manifests.componentManifest.components.button).not.toHaveProperty('stories');
    expect(manifests.componentManifest.components.button).toMatchObject({
      id: 'button',
      name: 'Button',
      summary: 'A button',
    });
  });

  it('keeps the shallow version marker when the manifest is shallow', async () => {
    const manifests = await createAccess({
      components: { v: 1, components: { button: { id: 'button', name: 'Button' } } },
    }).list({ withStoryIds: true });

    expect(manifests.componentManifest.v).toBe(1);
    expect(manifests.docsManifest).toBeUndefined();
  });

  it('returns an empty listing when no manifests are configured', async () => {
    await expect(createAccess({}).list({ withStoryIds: true })).resolves.toEqual({
      componentManifest: { v: 1, components: {} },
    });
  });
});

describe('createManifestDocsAccess resolve', () => {
  it('resolves a component with everything the inline manifest carries', async () => {
    await expect(createAccess().resolve('button')).resolves.toEqual({
      kind: 'component',
      component: button,
    });
  });

  it('falls through to the docs manifest', async () => {
    await expect(createAccess().resolve('guide--docs')).resolves.toEqual({
      kind: 'doc',
      doc: guide,
    });
  });

  it('returns undefined for unknown ids', async () => {
    await expect(createAccess().resolve('nope')).resolves.toBeUndefined();
  });

  it.each(['constructor', 'toString', 'hasOwnProperty'])(
    'answers absence for the prototype member %s instead of rendering it',
    async (id) => {
      await expect(createAccess().resolve(id)).resolves.toBeUndefined();
    }
  );

  it('reloads the manifests on every call so edits are picked up', async () => {
    const getManifests = vi.fn(async () => inlineManifests);
    const access = createManifestDocsAccess({ getManifests });

    await access.list({ withStoryIds: true });
    await access.resolve('button');

    expect(getManifests).toHaveBeenCalledTimes(2);
  });
});
