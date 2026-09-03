import { afterEach, describe, expect, it, vi } from 'vitest';

import type { StoryIndex } from '../../../../types/modules/indexer.ts';
import { clearRegistry } from '../../server.ts';
import { registerStoryIndexService, type StoryIndexSource } from './server.ts';

afterEach(() => {
  clearRegistry();
});

function makeIndex(ids: string[]): StoryIndex {
  return {
    v: 5,
    entries: Object.fromEntries(
      ids.map((id) => [
        id,
        {
          id,
          name: id,
          title: 'Comp',
          type: 'story',
          subtype: 'story',
          importPath: './comp.stories.tsx',
        },
      ])
    ),
  };
}

function makeSource(initial: StoryIndex) {
  let current = initial;
  const listeners = new Set<() => void>();
  const source: StoryIndexSource = {
    getIndex: vi.fn(async () => current),
    onInvalidated: vi.fn((listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }),
  };
  return {
    source,
    getSource: vi.fn(async () => source),
    invalidate(next: StoryIndex) {
      current = next;
      listeners.forEach((listener) => listener());
    },
  };
}

describe('story-index open service', () => {
  it('reads the index from the source on the first load and stores it', async () => {
    const index = makeIndex(['button--primary']);
    const { getSource, source } = makeSource(index);
    const service = registerStoryIndexService({ getSource });

    expect(service.queries.index.get()).toBeUndefined();
    expect(getSource).not.toHaveBeenCalled();

    await expect(service.queries.index.loaded()).resolves.toEqual(index);
    expect(service.queries.index.get()).toEqual(index);
    expect(source.getIndex).toHaveBeenCalledTimes(1);
  });

  it('serves the stored index without touching the source again', async () => {
    const { getSource, source } = makeSource(makeIndex(['button--primary']));
    const service = registerStoryIndexService({ getSource });

    await service.queries.index.loaded();
    await service.queries.index.loaded();

    expect(source.getIndex).toHaveBeenCalledTimes(1);
    expect(source.onInvalidated).toHaveBeenCalledTimes(1);
  });

  it('drops the stored index when the source invalidates and reads the next one on load', async () => {
    const { getSource, source, invalidate } = makeSource(makeIndex(['button--primary']));
    const service = registerStoryIndexService({ getSource });
    await service.queries.index.loaded();

    const next = makeIndex(['button--primary', 'button--secondary']);
    invalidate(next);

    await vi.waitFor(() => expect(service.queries.index.get()).toBeUndefined());
    await expect(service.queries.index.loaded()).resolves.toEqual(next);
    expect(source.getIndex).toHaveBeenCalledTimes(2);
    expect(source.onInvalidated).toHaveBeenCalledTimes(1);
  });

  it('re-reads when the source invalidates while a read is in flight', async () => {
    const stale = makeIndex(['button--primary']);
    const fresh = makeIndex(['button--primary', 'button--secondary']);
    const { getSource, source, invalidate } = makeSource(stale);
    let releaseFirstRead = () => {};
    vi.mocked(source.getIndex).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          releaseFirstRead = () => resolve(stale);
        })
    );
    const service = registerStoryIndexService({ getSource });

    const loading = service.queries.index.loaded();
    await vi.waitFor(() => expect(source.onInvalidated).toHaveBeenCalledTimes(1));
    invalidate(fresh);
    releaseFirstRead();

    await expect(loading).resolves.toEqual(fresh);
    expect(source.getIndex).toHaveBeenCalledTimes(2);
  });

  it('surfaces a failing source through loaded() and stores nothing', async () => {
    const { getSource, source } = makeSource(makeIndex([]));
    vi.mocked(source.getIndex).mockRejectedValueOnce(new Error('Duplicate stories'));
    const service = registerStoryIndexService({ getSource });

    await expect(service.queries.index.loaded()).rejects.toThrow('Duplicate stories');
    expect(service.queries.index.get()).toBeUndefined();
  });
});
