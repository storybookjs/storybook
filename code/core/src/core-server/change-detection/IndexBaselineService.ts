import { createFileSystemCache, resolvePathInStorybookCache } from 'storybook/internal/common';
import type { StoryIndex } from 'storybook/internal/types';

import type { StoryIndexGenerator } from '../utils/StoryIndexGenerator.ts';
import type { GitDiffProvider } from './GitDiffProvider.ts';

const DEFAULT_CACHE_KEY = 'index-baseline';

type BaselineSnapshot = {
  entryIds: string[];
};

type BaselineCache = {
  get: <T = unknown>(key: string) => Promise<T | undefined>;
  set: <T = unknown>(key: string, value: T) => Promise<void>;
};

export function extractBaselineEntryIds(storyIndex: StoryIndex): Set<string> {
  const entryIds = new Set<string>();

  Object.values(storyIndex.entries).forEach((entry) => {
    if (
      (entry.type === 'story' || entry.type === 'docs') &&
      !entry.importPath.startsWith('virtual:')
    ) {
      entryIds.add(entry.id);
    }
  });

  return entryIds;
}

export class IndexBaselineService {
  private baselineEntryIds = new Set<string>();
  private initializePromise: Promise<void> | undefined;
  private syncInFlight = false;
  private cache: BaselineCache;

  constructor(
    private readonly options: {
      storyIndexGeneratorPromise: Promise<StoryIndexGenerator>;
      gitDiffProvider: GitDiffProvider;
      onBaselineUpdated: () => void;
      cache?: BaselineCache;
    }
  ) {
    this.cache =
      options.cache ??
      createFileSystemCache({
        basePath: resolvePathInStorybookCache(DEFAULT_CACHE_KEY),
        ns: 'storybook',
      });
  }

  start(): Promise<void> {
    if (!this.initializePromise) {
      this.initializePromise = this.initialize().catch(() => {
        this.baselineEntryIds = new Set();
      });
    }
    return this.initializePromise;
  }

  async getBaselineEntryIds(): Promise<Set<string>> {
    await this.start();
    return new Set(this.baselineEntryIds);
  }

  async handleGitStateChange(): Promise<void> {
    await this.start();
    if (this.syncInFlight) {
      return;
    }

    try {
      this.syncInFlight = true;
      const isClean = await this.options.gitDiffProvider.isWorkingTreeClean();
      if (!isClean) {
        return;
      }

      const headCommit = await this.options.gitDiffProvider.getHeadCommit();
      await this.refreshBaseline(headCommit);
      this.options.onBaselineUpdated();
    } finally {
      this.syncInFlight = false;
    }
  }

  private async initialize(): Promise<void> {
    const isClean = await this.options.gitDiffProvider.isWorkingTreeClean();
    if (!isClean) {
      await this.refreshBaseline();
      return;
    }

    const headCommit = await this.options.gitDiffProvider.getHeadCommit();
    const cachedSnapshot = await this.cache.get<BaselineSnapshot>(headCommit);
    if (cachedSnapshot?.entryIds?.length) {
      this.baselineEntryIds = new Set(cachedSnapshot.entryIds);
      return;
    }

    await this.refreshBaseline(headCommit);
  }

  private async refreshBaseline(persistenceKey?: string): Promise<void> {
    const storyIndexGenerator = await this.options.storyIndexGeneratorPromise;
    const storyIndex = await storyIndexGenerator.getIndex();
    const entryIds = Array.from(extractBaselineEntryIds(storyIndex)).sort();
    this.baselineEntryIds = new Set(entryIds);

    if (persistenceKey) {
      await this.cache.set(persistenceKey, { entryIds });
    }
  }
}
