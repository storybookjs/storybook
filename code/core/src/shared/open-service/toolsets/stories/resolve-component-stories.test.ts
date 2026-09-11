import { existsSync, realpathSync } from 'node:fs';
import path from 'node:path';

import type { StoryIndex } from 'storybook/internal/types';

import { vol } from 'memfs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  ModuleGraphAccess,
  ModuleGraphStatus,
  ModuleGraphStoryHit,
  ResolveComponentStoriesDeps,
} from './resolve-component-stories.ts';
import { resolveComponentStories } from './resolve-component-stories.ts';

vi.mock('node:fs', { spy: true });

// `path.resolve` gives the fixture a drive letter on Windows, matching what the
// resolver's own `resolve(workingDir, …)` produces there.
const FAKE_WORKING_DIR = path.resolve('/repo');
const BADGE_ABS = path.join(FAKE_WORKING_DIR, 'src/components/Badge/Badge.tsx');
const BADGE_BARREL = path.join(FAKE_WORKING_DIR, 'src/components/Badge/index.ts');

/** The forward-slashed form the resolver queries the module graph with. */
const asGraphPath = (p: string) => path.normalize(p).replaceAll('\\', '/');
const storyFileAbs = (rel: string) => path.join(FAKE_WORKING_DIR, rel);

/**
 * Stubs the module-graph service surface. `storiesByFile` keys are the forward-slashed absolute
 * input paths the resolver looks up; values are the relative story-file hits the graph returns.
 */
function moduleGraphStub(opts: {
  status?: ModuleGraphStatus;
  storiesByFile?: Record<string, ModuleGraphStoryHit[]>;
}): ModuleGraphAccess {
  const status: ModuleGraphStatus = opts.status ?? { value: 'ready' };
  const storiesByFile = opts.storiesByFile ?? {};
  return {
    queries: {
      status: { loaded: async () => status },
      storiesForFiles: {
        loaded: async ({ files }) => files.map((file) => storiesByFile[file] ?? []),
      },
    },
  };
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

function depsFor(
  byFile: Record<string, string[]> = {},
  moduleGraph: ModuleGraphAccess | undefined = moduleGraphStub({})
): ResolveComponentStoriesDeps {
  const index = buildStoryIndex(byFile);
  return { getStoryIndex: async () => index, moduleGraph, workingDir: FAKE_WORKING_DIR };
}

beforeEach(() => {
  vol.reset();
  vol.fromNestedJSON({ [BADGE_ABS]: '' });
  vi.mocked(existsSync).mockImplementation((filePath) => vol.existsSync(filePath));
  vi.mocked(realpathSync.native).mockImplementation((filePath) =>
    String(vol.realpathSync(filePath))
  );
});

describe('resolveComponentStories', () => {
  it('strips trailing slashes so `Badge.tsx/` queries the file, not the parent-name barrel', async () => {
    // Regression for the silent-corruption bug: when a caller pastes
    // `Badge/Badge.tsx/`, the trailing slash flipped `basename === dirname`
    // in the barrel-expansion heuristic and we returned stories that
    // consumed the *barrel* (`Badge/index.ts`) instead of `Badge.tsx`.
    const graph = moduleGraphStub({
      storiesByFile: {
        [asGraphPath(BADGE_ABS)]: [
          { storyFile: './src/A.stories.tsx', depth: 1 },
          { storyFile: './src/B.stories.tsx', depth: 2 },
        ],
        [asGraphPath(BADGE_BARREL)]: [{ storyFile: './src/C.stories.tsx', depth: 1 }],
      },
    });
    const res = await resolveComponentStories(
      { componentPaths: [`${BADGE_ABS}/`] },
      depsFor(
        {
          [storyFileAbs('src/A.stories.tsx')]: ['a--default'],
          [storyFileAbs('src/B.stories.tsx')]: ['b--default'],
          [storyFileAbs('src/C.stories.tsx')]: ['c--default'],
        },
        graph
      )
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
    const graph = moduleGraphStub({
      storiesByFile: { [asGraphPath(BADGE_ABS)]: [{ storyFile: './src/A.stories.tsx', depth: 1 }] },
    });
    const res = await resolveComponentStories(
      { componentPaths: ['src/components/Badge/Badge.tsx'] },
      depsFor({ [storyFileAbs('src/A.stories.tsx')]: ['a--default'] }, graph)
    );
    expect(res.results?.[0]?.matches.map((m) => m.storyId)).toEqual(['a--default']);
  });

  it('normalizes redundant slashes (`/services//webapp/`)', async () => {
    const graph = moduleGraphStub({
      storiesByFile: { [asGraphPath(BADGE_ABS)]: [{ storyFile: './src/A.stories.tsx', depth: 1 }] },
    });
    const res = await resolveComponentStories(
      { componentPaths: [`${FAKE_WORKING_DIR}${path.sep}src//components/Badge/Badge.tsx`] },
      depsFor({ [storyFileAbs('src/A.stories.tsx')]: ['a--default'] }, graph)
    );
    expect(res.results?.[0]?.matches.map((m) => m.storyId)).toEqual(['a--default']);
  });

  it('maps `./`-less story index importPaths to the relative hits the module graph returns', async () => {
    // The story index here uses `src/A.stories.tsx` (no `./`); the module graph returns
    // `./src/A.stories.tsx`. The resolver normalizes both to the same form so they line up.
    const graph = moduleGraphStub({
      storiesByFile: { [asGraphPath(BADGE_ABS)]: [{ storyFile: './src/A.stories.tsx', depth: 3 }] },
    });
    const res = await resolveComponentStories(
      { componentPaths: [BADGE_ABS] },
      depsFor({ [storyFileAbs('src/A.stories.tsx')]: ['a--default'] }, graph)
    );
    expect(res.results?.[0]?.matches).toEqual([{ storyId: 'a--default', depth: 3 }]);
  });

  it('skips virtual: importPath entries when building the file→storyIds map', async () => {
    const graph = moduleGraphStub({
      storiesByFile: { [asGraphPath(BADGE_ABS)]: [{ storyFile: './src/A.stories.tsx', depth: 1 }] },
    });
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
      {
        getStoryIndex: async () => indexWithVirtual,
        moduleGraph: graph,
        workingDir: FAKE_WORKING_DIR,
      }
    );
    expect(res.results?.[0]?.matches.map((m) => m.storyId)).toEqual(['a--default']);
  });

  it('expands barrel targets and merges the minimum depth across them', async () => {
    // `Badge/Badge.tsx` ↔ `Badge/index.ts`: both reach `A.stories.tsx`, but via different
    // depths. The merge must keep the shorter (barrel) path's depth.
    vol.fromNestedJSON({ [BADGE_BARREL]: '' });
    const graph = moduleGraphStub({
      storiesByFile: {
        [asGraphPath(BADGE_ABS)]: [{ storyFile: './src/A.stories.tsx', depth: 2 }],
        [asGraphPath(BADGE_BARREL)]: [{ storyFile: './src/A.stories.tsx', depth: 1 }],
      },
    });
    const res = await resolveComponentStories(
      { componentPaths: [BADGE_ABS] },
      depsFor({ [storyFileAbs('src/A.stories.tsx')]: ['a--default'] }, graph)
    );
    expect(res.results?.[0]?.matches).toEqual([{ storyId: 'a--default', depth: 1 }]);
  });

  it('canonicalises wrong-case input so case-insensitive filesystems still hit the index', async () => {
    const wrongCase = path.join(FAKE_WORKING_DIR, 'src/components/BADGE/Badge.tsx');
    vi.mocked(realpathSync.native).mockImplementation((filePath) =>
      asGraphPath(String(filePath)) === asGraphPath(wrongCase)
        ? BADGE_ABS
        : String(vol.realpathSync(filePath))
    );
    // Only the canonical spelling is a key in the reverse index.
    const graph = moduleGraphStub({
      storiesByFile: { [asGraphPath(BADGE_ABS)]: [{ storyFile: './src/A.stories.tsx', depth: 1 }] },
    });
    const res = await resolveComponentStories(
      { componentPaths: [wrongCase] },
      depsFor({ [storyFileAbs('src/A.stories.tsx')]: ['a--default'] }, graph)
    );
    expect(res.results?.[0]?.matches).toEqual([{ storyId: 'a--default', depth: 1 }]);
  });

  it('dedupes repeated component paths into a single result', async () => {
    const graph = moduleGraphStub({
      storiesByFile: { [asGraphPath(BADGE_ABS)]: [{ storyFile: './src/A.stories.tsx', depth: 1 }] },
    });
    const res = await resolveComponentStories(
      { componentPaths: [BADGE_ABS, BADGE_ABS] },
      depsFor({ [storyFileAbs('src/A.stories.tsx')]: ['a--default'] }, graph)
    );
    expect(res.results).toHaveLength(1);
    expect(res.results?.[0]?.matches.map((m) => m.storyId)).toEqual(['a--default']);
  });

  it('sorts matches by depth, then by story id', async () => {
    const graph = moduleGraphStub({
      storiesByFile: {
        [asGraphPath(BADGE_ABS)]: [
          { storyFile: './src/A.stories.tsx', depth: 2 },
          { storyFile: './src/B.stories.tsx', depth: 1 },
        ],
      },
    });
    const res = await resolveComponentStories(
      { componentPaths: [BADGE_ABS] },
      depsFor(
        {
          [storyFileAbs('src/A.stories.tsx')]: ['b--second', 'a--first'],
          [storyFileAbs('src/B.stories.tsx')]: ['z--closest'],
        },
        graph
      )
    );
    expect(res.results?.[0]?.matches).toEqual([
      { storyId: 'z--closest', depth: 1 },
      { storyId: 'a--first', depth: 2 },
      { storyId: 'b--second', depth: 2 },
    ]);
  });

  it('flags pathNotFound when the component file does not exist on disk', async () => {
    const ghost = path.join(FAKE_WORKING_DIR, 'src/components/Ghost/Ghost.tsx');
    const res = await resolveComponentStories({ componentPaths: [ghost] }, depsFor());
    expect(res.available).toBe(true);
    expect(res.results?.[0]?.pathNotFound).toBe(true);
    expect(res.results?.[0]?.matches).toEqual([]);
  });

  it('rethrows non-ENOENT realpath failures instead of misreporting them as pathNotFound', async () => {
    // A permission/IO error is a real failure, not a missing path — surfacing it as
    // `pathNotFound` would hide the underlying cause, so the resolver must let it propagate.
    const locked = path.join(FAKE_WORKING_DIR, 'src/components/Locked/Locked.tsx');
    vi.mocked(realpathSync.native).mockImplementation((filePath) => {
      if (asGraphPath(String(filePath)) === asGraphPath(locked)) {
        throw Object.assign(new Error(`EACCES: ${locked}`), { code: 'EACCES' });
      }
      return String(vol.realpathSync(filePath));
    });
    await expect(resolveComponentStories({ componentPaths: [locked] }, depsFor())).rejects.toThrow(
      /EACCES/
    );
  });

  it('returns available:false when the module graph service is not registered', async () => {
    const res = await resolveComponentStories(
      { componentPaths: [BADGE_ABS] },
      { ...depsFor(), moduleGraph: undefined }
    );
    expect(res.available).toBe(false);
    expect(res.reason).toMatch(/module graph is unavailable/i);
    expect(res.results).toBeUndefined();
  });

  it('returns available:false while the graph is still booting', async () => {
    const res = await resolveComponentStories(
      { componentPaths: [BADGE_ABS] },
      depsFor({}, moduleGraphStub({ status: { value: 'booting' } }))
    );
    expect(res.available).toBe(false);
    expect(res.reason).toMatch(/hasn't built yet/i);
  });

  it('returns available:false with the remedy the agent needs when unavailable', async () => {
    const res = await resolveComponentStories(
      { componentPaths: [BADGE_ABS] },
      depsFor(
        {},
        moduleGraphStub({
          status: { value: 'unavailable', reason: 'builder does not support change detection' },
        })
      )
    );
    expect(res.available).toBe(false);
    // The service's cause plus the remedy: the agent is told what failed and what to change.
    expect(res.reason).toBe(
      "Storybook's story dependency graph is unavailable: builder does not support change detection. Make sure the dev server is running with a builder that supports change detection."
    );
  });

  it('returns available:false with the serialized error message when the graph errored', async () => {
    const res = await resolveComponentStories(
      { componentPaths: [BADGE_ABS] },
      depsFor(
        {},
        moduleGraphStub({ status: { value: 'error', error: { message: 'boom while parsing' } } })
      )
    );
    expect(res.available).toBe(false);
    expect(res.reason).toMatch(/boom while parsing/);
  });
});
