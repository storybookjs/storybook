import { describe, expect, it, vi } from 'vitest';

import type { StoryIndex } from 'storybook/internal/types';

import type { StoryIndexGenerator } from '../utils/StoryIndexGenerator.ts';
import { GitDiffProvider } from './GitDiffProvider.ts';
import { extractBaselineEntryIds, IndexBaselineService } from './IndexBaselineService.ts';

function createStoryIndex(entryIds: string[]): StoryIndex {
  return {
    v: 5,
    entries: Object.fromEntries(
      entryIds.map((id) => [
        id,
        {
          id,
          type: 'story',
          subtype: 'story',
          title: id,
          name: id,
          importPath: `./${id}.stories.ts`,
        },
      ])
    ),
  };
}

function createIndex(entries: StoryIndex['entries']): StoryIndex {
  return {
    v: 5,
    entries,
  };
}

class MockGitDiffProvider extends GitDiffProvider {
  clean = true;
  headCommit = 'sha-1';
  isWorkingTreeCleanMock = vi.fn(async () => this.clean);
  getHeadCommitMock = vi.fn(async () => this.headCommit);

  constructor() {
    super('/repo');
  }

  override isWorkingTreeClean(): Promise<boolean> {
    return this.isWorkingTreeCleanMock();
  }

  override getHeadCommit(): Promise<string> {
    return this.getHeadCommitMock();
  }
}

type BaselineCache = {
  get: <T = unknown>(key: string) => Promise<T | undefined>;
  set: <T = unknown>(key: string, value: T) => Promise<void>;
};

function createCache(initial: Record<string, unknown> = {}) {
  const store = new Map<string, unknown>(Object.entries(initial));
  const cache: BaselineCache = {
    get: vi.fn(async (key: string) => store.get(key)) as BaselineCache['get'],
    set: vi.fn(async (key: string, value: unknown) => {
      store.set(key, value);
    }) as BaselineCache['set'],
  };

  return { cache, store };
}

function createStoryIndexGenerator(indexes: StoryIndex[]) {
  let call = 0;
  return {
    getIndex: vi.fn(async () => indexes[Math.min(call++, indexes.length - 1)]),
  } as unknown as StoryIndexGenerator;
}

describe('IndexBaselineService', () => {
  it('persists a snapshot on clean startup cache miss', async () => {
    const gitDiffProvider = new MockGitDiffProvider();
    const { cache, store } = createCache();
    const generator = createStoryIndexGenerator([createStoryIndex(['a', 'b'])]);

    const service = new IndexBaselineService({
      storyIndexGeneratorPromise: Promise.resolve(generator),
      gitDiffProvider,
      cache,
      onBaselineUpdated: vi.fn(),
    });

    await service.start();

    expect(cache.set).toHaveBeenCalledWith('sha-1', { entryIds: ['a', 'b'] });
    expect(store.get('sha-1')).toEqual({ entryIds: ['a', 'b'] });
    expect(await service.getBaselineEntryIds()).toEqual(new Set(['a', 'b']));
  });

  it('uses cached snapshot on clean startup cache hit', async () => {
    const gitDiffProvider = new MockGitDiffProvider();
    const { cache } = createCache({ 'sha-1': { entryIds: ['cached'] } });
    const generator = createStoryIndexGenerator([createStoryIndex(['runtime'])]);

    const service = new IndexBaselineService({
      storyIndexGeneratorPromise: Promise.resolve(generator),
      gitDiffProvider,
      cache,
      onBaselineUpdated: vi.fn(),
    });

    await service.start();

    expect(generator.getIndex).not.toHaveBeenCalled();
    expect(await service.getBaselineEntryIds()).toEqual(new Set(['cached']));
  });

  it('keeps in-memory snapshot when startup is dirty', async () => {
    const gitDiffProvider = new MockGitDiffProvider();
    gitDiffProvider.clean = false;
    const { cache } = createCache();
    const generator = createStoryIndexGenerator([createStoryIndex(['dirty'])]);

    const service = new IndexBaselineService({
      storyIndexGeneratorPromise: Promise.resolve(generator),
      gitDiffProvider,
      cache,
      onBaselineUpdated: vi.fn(),
    });

    await service.start();

    expect(cache.set).not.toHaveBeenCalled();
    expect(await service.getBaselineEntryIds()).toEqual(new Set(['dirty']));
  });

  it('regenerates and persists when git state becomes clean', async () => {
    const gitDiffProvider = new MockGitDiffProvider();
    gitDiffProvider.clean = false;
    const onBaselineUpdated = vi.fn();
    const { cache } = createCache();
    const generator = createStoryIndexGenerator([
      createStoryIndex(['dirty']),
      createStoryIndex(['clean']),
    ]);

    const service = new IndexBaselineService({
      storyIndexGeneratorPromise: Promise.resolve(generator),
      gitDiffProvider,
      cache,
      onBaselineUpdated,
    });

    await service.start();
    gitDiffProvider.clean = true;

    await service.handleGitStateChange();

    expect(cache.set).toHaveBeenCalledWith('sha-1', { entryIds: ['clean'] });
    expect(onBaselineUpdated).toHaveBeenCalledTimes(1);
    expect(await service.getBaselineEntryIds()).toEqual(new Set(['clean']));
  });
});

describe('extractBaselineEntryIds', () => {
  it('includes story and docs entries', () => {
    const storyIndex = createIndex({
      story: {
        id: 'story',
        type: 'story',
        subtype: 'story',
        title: 'Story',
        name: 'Story',
        importPath: './story.stories.ts',
      },
      docs: {
        id: 'docs',
        type: 'docs',
        title: 'Docs',
        name: 'Docs',
        importPath: './story.mdx',
        storiesImports: [],
      },
    });

    expect(extractBaselineEntryIds(storyIndex)).toEqual(new Set(['story', 'docs']));
  });

  it('excludes virtual imports and returns deterministic order', () => {
    const storyIndex = createIndex({
      zeta: {
        id: 'zeta',
        type: 'story',
        subtype: 'story',
        title: 'Zeta',
        name: 'Zeta',
        importPath: './zeta.stories.ts',
      },
      virtualStory: {
        id: 'virtualStory',
        type: 'story',
        subtype: 'story',
        title: 'Virtual',
        name: 'Virtual',
        importPath: 'virtual:story',
      },
      alpha: {
        id: 'alpha',
        type: 'docs',
        title: 'Alpha',
        name: 'Alpha',
        importPath: './alpha.mdx',
        storiesImports: [],
      },
    });

    expect(Array.from(extractBaselineEntryIds(storyIndex)).sort()).toEqual(['alpha', 'zeta']);
  });
});
