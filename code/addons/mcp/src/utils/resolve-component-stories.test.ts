import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import path from 'node:path';
import type { StoryIndex } from 'storybook/internal/types';
import type { ModuleGraphStatus, ModuleGraphStoryHit } from './module-graph.ts';

// Static import would freeze the mock target before each test gets a chance
// to swap the underlying core-server module. We dynamically `import()` after
// `vi.doMock` instead — see each test below.

// The resolver canonicalises every input path with `fs.realpathSync.native` and probes
// barrel candidates with `fs.existsSync`. These unit tests operate on synthetic paths that
// don't exist on disk, so we stub `node:fs` with caller-controlled sets: `existingPaths`
// drives `existsSync` (barrel sibling probing) and `missingPaths` drives realpath ENOENT
// (the "path not found" branch). Both default to empty so paths are their own canonical form
// and have no barrel siblings unless a test opts in.
const { existingPaths, missingPaths, ioErrorPaths } = vi.hoisted(() => ({
  existingPaths: new Set<string>(),
  missingPaths: new Set<string>(),
  ioErrorPaths: new Set<string>(),
}));

vi.mock('node:fs', () => {
  const realpathSync: any = (p: string) => {
    if (ioErrorPaths.has(p)) {
      throw Object.assign(new Error(`EACCES: ${p}`), { code: 'EACCES' });
    }
    if (missingPaths.has(p)) {
      throw Object.assign(new Error(`ENOENT: ${p}`), { code: 'ENOENT' });
    }
    return p;
  };
  realpathSync.native = realpathSync;
  const fs = { realpathSync, existsSync: (p: string) => existingPaths.has(p) };
  return { ...fs, default: fs };
});

const FAKE_WORKING_DIR = '/repo';
const BADGE_ABS = path.join(FAKE_WORKING_DIR, 'src/components/Badge/Badge.tsx');
const BADGE_BARREL = path.join(FAKE_WORKING_DIR, 'src/components/Badge/index.ts');

/**
 * Mocks the `core/module-graph` open service via `getService`. `storiesByFile` keys are the
 * forward-slashed absolute input paths the resolver looks up; values are the relative story-file
 * hits the module graph returns for them.
 */
function setupService(opts: {
  status?: ModuleGraphStatus;
  storiesByFile?: Record<string, ModuleGraphStoryHit[]>;
}) {
  const status: ModuleGraphStatus = opts.status ?? { value: 'ready' };
  const storiesByFile = opts.storiesByFile ?? {};
  const stub = {
    queries: {
      status: { loaded: async () => status },
      storiesForFiles: {
        loaded: async ({ files }: { files: string[] }) => files.map((f) => storiesByFile[f] ?? []),
      },
    },
  };
  vi.doMock('storybook/internal/core-server', () => ({
    getService: () => stub,
  }));
}

function buildStoryIndex(byFile: Record<string, string[]>): StoryIndex {
  const entries: StoryIndex['entries'] = {};
  for (const [absStoryFile, ids] of Object.entries(byFile)) {
    const relative = path.relative(FAKE_WORKING_DIR, absStoryFile);
    for (const id of ids) {
      entries[id] = {
        type: 'story',
        subtype: 'story',
        id,
        name: id,
        title: id,
        importPath: relative,
        tags: [],
      } as StoryIndex['entries'][string];
    }
  }
  return { v: 5, entries };
}

function depsFor(byFile: Record<string, string[]> = {}, workingDir = FAKE_WORKING_DIR) {
  const index = buildStoryIndex(byFile);
  return { getStoryIndex: async () => index, workingDir };
}

beforeEach(() => {
  vi.resetModules();
  existingPaths.clear();
  missingPaths.clear();
  ioErrorPaths.clear();
});

afterEach(() => {
  vi.resetModules();
  vi.doUnmock('storybook/internal/core-server');
});

describe('resolveComponentStories', () => {
  it('strips trailing slashes so `Badge.tsx/` queries the file, not the parent-name barrel', async () => {
    // Regression for the silent-corruption bug: when a caller pastes
    // `Badge/Badge.tsx/`, the trailing slash flipped `basename === dirname`
    // in the barrel-expansion heuristic and we returned stories that
    // consumed the *barrel* (`Badge/index.ts`) instead of `Badge.tsx`.
    setupService({
      storiesByFile: {
        [BADGE_ABS]: [
          { storyFile: './src/A.stories.tsx', depth: 1 },
          { storyFile: './src/B.stories.tsx', depth: 2 },
        ],
        [BADGE_BARREL]: [{ storyFile: './src/C.stories.tsx', depth: 1 }], // unrelated barrel consumer
      },
    });
    const { resolveComponentStories } = await import('./resolve-component-stories.ts');
    const res = await resolveComponentStories(
      { componentPaths: [`${BADGE_ABS}/`] },
      depsFor({
        '/repo/src/A.stories.tsx': ['a--default'],
        '/repo/src/B.stories.tsx': ['b--default'],
        '/repo/src/C.stories.tsx': ['c--default'],
      })
    );
    expect(res.available).toBe(true);
    expect(res.results?.[0]?.matches.map((m) => m.storyId).sort()).toEqual([
      'a--default',
      'b--default',
    ]);
    // And critically does NOT include the barrel-only consumer:
    expect(res.results?.[0]?.matches.map((m) => m.storyId)).not.toContain('c--default');
  });

  it('resolves relative paths against the workingDir', async () => {
    setupService({
      storiesByFile: { [BADGE_ABS]: [{ storyFile: './src/A.stories.tsx', depth: 1 }] },
    });
    const { resolveComponentStories } = await import('./resolve-component-stories.ts');
    const res = await resolveComponentStories(
      { componentPaths: ['src/components/Badge/Badge.tsx'] },
      depsFor({ '/repo/src/A.stories.tsx': ['a--default'] })
    );
    expect(res.results?.[0]?.matches.map((m) => m.storyId)).toEqual(['a--default']);
  });

  it('normalizes redundant slashes (`/services//webapp/`)', async () => {
    setupService({
      storiesByFile: { [BADGE_ABS]: [{ storyFile: './src/A.stories.tsx', depth: 1 }] },
    });
    const { resolveComponentStories } = await import('./resolve-component-stories.ts');
    const res = await resolveComponentStories(
      { componentPaths: ['/repo/src//components/Badge/Badge.tsx'] },
      depsFor({ '/repo/src/A.stories.tsx': ['a--default'] })
    );
    expect(res.results?.[0]?.matches.map((m) => m.storyId)).toEqual(['a--default']);
  });

  it('maps `./`-less story index importPaths to the relative hits the module graph returns', async () => {
    // The story index here uses `src/A.stories.tsx` (no `./`); the module graph returns
    // `./src/A.stories.tsx`. The resolver normalizes both to the same form so they line up.
    setupService({
      storiesByFile: { [BADGE_ABS]: [{ storyFile: './src/A.stories.tsx', depth: 3 }] },
    });
    const { resolveComponentStories } = await import('./resolve-component-stories.ts');
    const res = await resolveComponentStories(
      { componentPaths: [BADGE_ABS] },
      depsFor({ '/repo/src/A.stories.tsx': ['a--default'] })
    );
    expect(res.results?.[0]?.matches).toEqual([{ storyId: 'a--default', depth: 3 }]);
  });

  it('skips virtual: importPath entries when building the file→storyIds map', async () => {
    setupService({
      storiesByFile: { [BADGE_ABS]: [{ storyFile: './src/A.stories.tsx', depth: 1 }] },
    });
    const { resolveComponentStories } = await import('./resolve-component-stories.ts');
    const indexWithVirtual: StoryIndex = {
      v: 5,
      entries: {
        'a--default': {
          type: 'story',
          subtype: 'story',
          id: 'a--default',
          name: 'Default',
          title: 'A',
          importPath: 'src/A.stories.tsx',
          tags: [],
        } as StoryIndex['entries'][string],
        'virtual--page': {
          type: 'story',
          subtype: 'story',
          id: 'virtual--page',
          name: 'Virtual',
          title: 'V',
          importPath: 'virtual:storybook/auto-docs',
          tags: [],
        } as StoryIndex['entries'][string],
      },
    };
    const res = await resolveComponentStories(
      { componentPaths: [BADGE_ABS] },
      { getStoryIndex: async () => indexWithVirtual, workingDir: FAKE_WORKING_DIR }
    );
    expect(res.results?.[0]?.matches.map((m) => m.storyId)).toEqual(['a--default']);
  });

  it('expands barrel targets and merges the minimum depth across them', async () => {
    // `Badge/Badge.tsx` ↔ `Badge/index.ts`: both reach `A.stories.tsx`, but via different
    // depths. The merge must keep the shorter (barrel) path's depth.
    existingPaths.add(BADGE_BARREL);
    setupService({
      storiesByFile: {
        [BADGE_ABS]: [{ storyFile: './src/A.stories.tsx', depth: 2 }],
        [BADGE_BARREL]: [{ storyFile: './src/A.stories.tsx', depth: 1 }],
      },
    });
    const { resolveComponentStories } = await import('./resolve-component-stories.ts');
    const res = await resolveComponentStories(
      { componentPaths: [BADGE_ABS] },
      depsFor({ '/repo/src/A.stories.tsx': ['a--default'] })
    );
    expect(res.results?.[0]?.matches).toEqual([{ storyId: 'a--default', depth: 1 }]);
  });

  it('flags pathNotFound when the component file does not exist on disk', async () => {
    const ghost = path.join(FAKE_WORKING_DIR, 'src/components/Ghost/Ghost.tsx');
    missingPaths.add(ghost);
    setupService({ storiesByFile: {} });
    const { resolveComponentStories } = await import('./resolve-component-stories.ts');
    const res = await resolveComponentStories({ componentPaths: [ghost] }, depsFor());
    expect(res.available).toBe(true);
    expect(res.results?.[0]?.pathNotFound).toBe(true);
    expect(res.results?.[0]?.matches).toEqual([]);
  });

  it('rethrows non-ENOENT realpath failures instead of misreporting them as pathNotFound', async () => {
    // A permission/IO error is a real failure, not a missing path — surfacing it as
    // `pathNotFound` would hide the underlying cause, so the resolver must let it propagate.
    const locked = path.join(FAKE_WORKING_DIR, 'src/components/Locked/Locked.tsx');
    ioErrorPaths.add(locked);
    setupService({ storiesByFile: {} });
    const { resolveComponentStories } = await import('./resolve-component-stories.ts');
    await expect(resolveComponentStories({ componentPaths: [locked] }, depsFor())).rejects.toThrow(
      /EACCES/
    );
  });

  it('returns available:false when the module graph service is not registered', async () => {
    vi.doMock('storybook/internal/core-server', () => ({
      getService: () => {
        throw new Error('service core/module-graph is not registered');
      },
    }));
    const { resolveComponentStories } = await import('./resolve-component-stories.ts');
    const res = await resolveComponentStories({ componentPaths: [BADGE_ABS] }, depsFor());
    expect(res.available).toBe(false);
    expect(res.reason).toMatch(/module graph is unavailable/i);
  });

  it('returns available:false on older Storybook versions that lack the open-service API', async () => {
    // Backwards-compat path: the module loads but `getService` is undefined (older Storybook).
    // The dynamic-import probe must treat this identically to "service unavailable".
    vi.doMock('storybook/internal/core-server', () => ({}));
    const { resolveComponentStories } = await import('./resolve-component-stories.ts');
    const res = await resolveComponentStories({ componentPaths: [BADGE_ABS] }, depsFor());
    expect(res.available).toBe(false);
    expect(res.reason).toMatch(/module graph is unavailable/i);
  });

  it('returns available:false while the graph is still booting', async () => {
    setupService({ status: { value: 'booting' } });
    const { resolveComponentStories } = await import('./resolve-component-stories.ts');
    const res = await resolveComponentStories({ componentPaths: [BADGE_ABS] }, depsFor());
    expect(res.available).toBe(false);
    expect(res.reason).toMatch(/hasn't built yet/i);
  });

  it('returns available:false with the service-provided reason when unavailable', async () => {
    setupService({
      status: { value: 'unavailable', reason: 'builder does not support change detection' },
    });
    const { resolveComponentStories } = await import('./resolve-component-stories.ts');
    const res = await resolveComponentStories({ componentPaths: [BADGE_ABS] }, depsFor());
    expect(res.available).toBe(false);
    expect(res.reason).toMatch(/does not support change detection/);
  });

  it('returns available:false with the serialized error message when the graph errored', async () => {
    setupService({ status: { value: 'error', error: { message: 'boom while parsing' } } });
    const { resolveComponentStories } = await import('./resolve-component-stories.ts');
    const res = await resolveComponentStories({ componentPaths: [BADGE_ABS] }, depsFor());
    expect(res.available).toBe(false);
    expect(res.reason).toMatch(/boom while parsing/);
  });
});
