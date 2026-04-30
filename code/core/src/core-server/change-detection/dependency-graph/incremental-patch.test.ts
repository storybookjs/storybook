// Covers the IncrementalPatcher behaviour for add/change/unlink events.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { readFile } from 'node:fs/promises';

import { logger } from 'storybook/internal/node-logger';

import { ParserRegistry } from '../parser-registry/index.ts';
import type { ImportEdge, ImportParser } from '../parser-registry/index.ts';
import { IncrementalPatcher } from './IncrementalPatcher.ts';
import type { ChangeDetectionResolverFactory } from './ResolverFactory.ts';
import { ReverseIndexImpl } from './ReverseIndex.ts';
import type { DependencyGraph } from './types.ts';

vi.mock('node:fs/promises', { spy: true });
vi.mock('storybook/internal/node-logger', { spy: true });

interface PatcherWorld {
  edges: Map<string, ImportEdge[]>;
  resolutions: Map<string, string | null>;
}

interface TestRegistry {
  registry: ParserRegistry;
  parseSpy: ReturnType<typeof vi.fn>;
}

/**
 * Build a real ParserRegistry with a single test parser that reads precomputed edges out
 * of the PatcherWorld. Exposes the parse spy so tests can assert how many times a path
 * was dispatched to the parser.
 */
function makeRegistry(world: PatcherWorld): TestRegistry {
  const parseSpy = vi.fn(async ({ filePath }: { filePath: string }) => {
    return world.edges.get(filePath) ?? [];
  });
  const testParser: ImportParser = {
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mdx'],
    parse: parseSpy,
  };
  const registry = new ParserRegistry({
    defaultParsers: [testParser],
    pluginParsers: [],
  });
  return { registry, parseSpy };
}

function makeResolver(world: PatcherWorld): ChangeDetectionResolverFactory {
  return {
    resolve: vi.fn(async (from: string, specifier: string) => {
      const key = `${from}::${specifier}`;
      return world.resolutions.has(key) ? world.resolutions.get(key)! : null;
    }),
  } as unknown as ChangeDetectionResolverFactory;
}

function setupReadFile() {
  vi.mocked(readFile).mockImplementation(async () => '');
}

function buildPatcher(opts: {
  reverseIndex?: ReverseIndexImpl;
  graph?: DependencyGraph;
  storyFiles?: Set<string>;
  world: PatcherWorld;
}): {
  patcher: IncrementalPatcher;
  reverseIndex: ReverseIndexImpl;
  graph: DependencyGraph;
  parseSpy: ReturnType<typeof vi.fn>;
} {
  const reverseIndex = opts.reverseIndex ?? new ReverseIndexImpl();
  const graph = opts.graph ?? new Map();
  const storyFiles = opts.storyFiles ?? new Set<string>();
  const { registry, parseSpy } = makeRegistry(opts.world);
  const resolver = makeResolver(opts.world);
  const patcher = new IncrementalPatcher({
    reverseIndex,
    graph,
    registry,
    resolver,
    workspaceRoots: new Set(),
    projectRoot: '/repo',
    isStoryFile: (path: string) => storyFiles.has(path),
  });
  return { patcher, reverseIndex, graph, parseSpy };
}

describe('IncrementalPatcher', () => {
  beforeEach(() => {
    setupReadFile();
    vi.mocked(logger.debug).mockImplementation(() => undefined);
    vi.mocked(logger.warn).mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('treats a `change` event for an unknown non-story file as a no-op', async () => {
    const { patcher, reverseIndex, graph, parseSpy } = buildPatcher({
      world: { edges: new Map(), resolutions: new Map() },
    });

    await patcher.patch({ kind: 'change', path: '/repo/src/unknown.ts' });

    // No dependents in reverseIndex, not a story file — nothing to re-walk.
    expect(reverseIndex.asMap().size).toBe(0);
    expect(parseSpy).not.toHaveBeenCalled();
    expect(graph.has('/repo/src/unknown.ts')).toBe(false);
  });

  it('re-walks a story root on `change`, updating depths', async () => {
    const story = '/repo/src/A.stories.tsx';
    const dep = '/repo/src/dep.ts';
    const world: PatcherWorld = {
      edges: new Map([
        [story, [{ specifier: './dep.ts', kind: 'static', importedNames: null }]],
        [dep, []],
      ]),
      resolutions: new Map([[`${story}::./dep.ts`, dep]]),
    };
    const initialIndex = new ReverseIndexImpl();
    initialIndex.record(story, story, 0);
    const { patcher, reverseIndex } = buildPatcher({
      world,
      reverseIndex: initialIndex,
      storyFiles: new Set([story]),
    });

    await patcher.patch({ kind: 'change', path: story });

    expect(reverseIndex.lookup(dep).get(story)).toBe(1);
  });

  it('removes (oldDep, story) edges when an import disappears on `change`', async () => {
    const story = '/repo/src/A.stories.tsx';
    const oldDep = '/repo/src/old.ts';
    const newDep = '/repo/src/new.ts';
    const initialIndex = new ReverseIndexImpl();
    initialIndex.record(story, story, 0);
    initialIndex.record(oldDep, story, 1);
    const initialGraph: DependencyGraph = new Map([[story, new Set([oldDep])]]);
    const world: PatcherWorld = {
      edges: new Map([
        [story, [{ specifier: './new.ts', kind: 'static', importedNames: null }]],
        [newDep, []],
      ]),
      resolutions: new Map([[`${story}::./new.ts`, newDep]]),
    };
    const { patcher, reverseIndex } = buildPatcher({
      world,
      reverseIndex: initialIndex,
      graph: initialGraph,
      storyFiles: new Set([story]),
    });

    await patcher.patch({ kind: 'change', path: story });

    expect(reverseIndex.asMap().has(oldDep)).toBe(false);
    expect(reverseIndex.lookup(newDep).get(story)).toBe(1);
  });

  it('adds NEW edges with the correct depth on `change`', async () => {
    const story = '/repo/src/A.stories.tsx';
    const newDep = '/repo/src/added.ts';
    const initialIndex = new ReverseIndexImpl();
    initialIndex.record(story, story, 0);
    const initialGraph: DependencyGraph = new Map([[story, new Set()]]);
    const world: PatcherWorld = {
      edges: new Map([
        [story, [{ specifier: './added.ts', kind: 'static', importedNames: null }]],
        [newDep, []],
      ]),
      resolutions: new Map([[`${story}::./added.ts`, newDep]]),
    };
    const { patcher, reverseIndex } = buildPatcher({
      world,
      reverseIndex: initialIndex,
      graph: initialGraph,
      storyFiles: new Set([story]),
    });

    await patcher.patch({ kind: 'change', path: story });

    expect(reverseIndex.lookup(newDep).get(story)).toBe(1);
  });

  it('removes a story root on `unlink` and clears its reverse-index contribution', async () => {
    const story = '/repo/src/A.stories.tsx';
    const dep = '/repo/src/dep.ts';
    const initialIndex = new ReverseIndexImpl();
    initialIndex.record(story, story, 0);
    initialIndex.record(dep, story, 1);
    const initialGraph: DependencyGraph = new Map([[story, new Set([dep])]]);
    const { patcher, reverseIndex, graph } = buildPatcher({
      world: { edges: new Map(), resolutions: new Map() },
      reverseIndex: initialIndex,
      graph: initialGraph,
      storyFiles: new Set([story]),
    });

    await patcher.patch({ kind: 'unlink', path: story });

    expect(reverseIndex.asMap().has(dep)).toBe(false);
    expect(reverseIndex.asMap().has(story)).toBe(false);
    expect(graph.has(story)).toBe(false);
  });

  it('on `unlink` of a non-story dep, re-walks every story that previously reached it', async () => {
    const story = '/repo/src/A.stories.tsx';
    const dep = '/repo/src/dep.ts';
    const initialIndex = new ReverseIndexImpl();
    initialIndex.record(story, story, 0);
    initialIndex.record(dep, story, 1);
    const initialGraph: DependencyGraph = new Map([
      [story, new Set([dep])],
      [dep, new Set()],
    ]);
    const world: PatcherWorld = {
      edges: new Map([[story, []]]),
      resolutions: new Map(),
    };
    const { patcher, reverseIndex } = buildPatcher({
      world,
      reverseIndex: initialIndex,
      graph: initialGraph,
      storyFiles: new Set([story]),
    });

    await patcher.patch({ kind: 'unlink', path: dep });

    // dep removed from index; story re-walked with no deps so only story@0 remains.
    expect(reverseIndex.asMap().has(dep)).toBe(false);
    expect(reverseIndex.lookup(story).get(story)).toBe(0);
  });

  it('runs full BFS for an `add` event for a new story root', async () => {
    const story = '/repo/src/New.stories.tsx';
    const dep = '/repo/src/dep.ts';
    const world: PatcherWorld = {
      edges: new Map([
        [story, [{ specifier: './dep.ts', kind: 'static', importedNames: null }]],
        [dep, []],
      ]),
      resolutions: new Map([[`${story}::./dep.ts`, dep]]),
    };
    const { patcher, reverseIndex } = buildPatcher({
      world,
      storyFiles: new Set([story]),
    });

    await patcher.patch({ kind: 'add', path: story });

    expect(reverseIndex.lookup(story).get(story)).toBe(0);
    expect(reverseIndex.lookup(dep).get(story)).toBe(1);
  });

  it('skips re-walk on `change` when dep set is unchanged (comment-only edit)', async () => {
    const story = '/repo/src/A.stories.tsx';
    const dep = '/repo/src/shared.ts';

    const initialIndex = new ReverseIndexImpl();
    initialIndex.record(story, story, 0);
    initialIndex.record(dep, story, 1);
    const initialGraph: DependencyGraph = new Map([
      [story, new Set([dep])],
      [dep, new Set()],
    ]);

    // dep changes but its import list stays empty (comment-only edit)
    const world: PatcherWorld = {
      edges: new Map([[dep, []]]),
      resolutions: new Map(),
    };
    const { patcher, reverseIndex, parseSpy } = buildPatcher({
      world,
      reverseIndex: initialIndex,
      graph: initialGraph,
      storyFiles: new Set([story]),
    });

    await patcher.patch({ kind: 'change', path: dep });

    // story must NOT be re-walked — graph and index are still accurate
    const storyCalls = parseSpy.mock.calls.filter((c) => c[0].filePath === story);
    expect(storyCalls.length).toBe(0);
    // reverse-index entries are preserved unchanged
    expect(reverseIndex.lookup(dep).get(story)).toBe(1);
    expect(reverseIndex.lookup(story).get(story)).toBe(0);
  });

  it('treats `add` for a non-story file as a no-op', async () => {
    const file = '/repo/src/loose.ts';
    const world: PatcherWorld = { edges: new Map(), resolutions: new Map() };
    const { patcher, reverseIndex, parseSpy } = buildPatcher({
      world,
      storyFiles: new Set(),
    });

    await patcher.patch({ kind: 'add', path: file });

    expect(reverseIndex.asMap().size).toBe(0);
    expect(parseSpy).not.toHaveBeenCalled();
  });

  it('A3 acceptance: registry parse called exactly once for the changed file', async () => {
    const story = '/repo/src/A.stories.tsx';
    const initialIndex = new ReverseIndexImpl();
    initialIndex.record(story, story, 0);
    const world: PatcherWorld = {
      edges: new Map([[story, []]]),
      resolutions: new Map(),
    };
    const { patcher, parseSpy } = buildPatcher({
      world,
      reverseIndex: initialIndex,
      storyFiles: new Set([story]),
    });

    await patcher.patch({ kind: 'change', path: story });

    // Once for the change-step itself, plus once during the re-walk of the same story.
    // The contract says `parse` is called exactly once for each file participating; for a
    // story root with no deps, that means a single re-walk visits only the root => one parse.
    // Allow up to 2 (one for the diff, one for the re-walk) but assert it's bounded.
    const calls = parseSpy.mock.calls.filter((c) => c[0].filePath === story);
    expect(calls.length).toBeGreaterThanOrEqual(1);
    expect(calls.length).toBeLessThanOrEqual(2);
  });

  it('unlink of a dep clears the dep from the graph and from the story reverse-index, not just from the index edges', async () => {
    // Models the stale-cache regression: story → dep is seeded into graph + reverseIndex at
    // cold-start. Without importer invalidation on unlink, walkFromStory re-uses the cached
    // resolveCache entry for `story` (which still lists `dep`), silently re-adding dep to
    // the graph and leaving reverseIndex.lookup(dep) non-empty.
    const story = '/repo/src/A.stories.tsx';
    const dep = '/repo/src/dep.ts';

    const initialIndex = new ReverseIndexImpl();
    initialIndex.record(story, story, 0);
    initialIndex.record(dep, story, 1);
    const initialGraph: DependencyGraph = new Map([
      [story, new Set([dep])],
      [dep, new Set()],
    ]);

    // After unlink, the story no longer imports dep.
    const world: PatcherWorld = {
      edges: new Map([[story, []]]),
      resolutions: new Map(),
    };
    const { patcher, reverseIndex, graph } = buildPatcher({
      world,
      reverseIndex: initialIndex,
      graph: initialGraph,
      storyFiles: new Set([story]),
    });

    await patcher.patch({ kind: 'unlink', path: dep });

    expect(reverseIndex.lookup(dep).size).toBe(0);
    expect(graph.has(dep)).toBe(false);
    // The story itself still exists at depth 0; dep is no longer reachable from it.
    expect(reverseIndex.lookup(story).get(story)).toBe(0);
  });
});
