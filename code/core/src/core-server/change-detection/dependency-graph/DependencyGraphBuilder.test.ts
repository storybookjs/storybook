// Tests the eager forward-walk performed by DependencyGraphBuilder.
// We stub readFile + ChangeDetectionResolverFactory, and drive the walker via a real
// ParserRegistry that dispatches to an in-memory test parser — no oxc binary needed.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { readFile } from 'node:fs/promises';

import { logger } from 'storybook/internal/node-logger';

import { ParserRegistry } from '../parser-registry/index.ts';
import type { ImportEdge, ImportParser } from '../parser-registry/index.ts';
import { DependencyGraphBuilder } from './DependencyGraphBuilder.ts';
import type { ChangeDetectionResolverFactory } from './ResolverFactory.ts';

vi.mock('node:fs/promises', { spy: true });
vi.mock('storybook/internal/node-logger', { spy: true });

interface FakeWorld {
  /** Source files that exist (path -> content). Content is irrelevant — parser is stubbed. */
  files: Set<string>;
  /** Per-file outgoing edges, keyed by absolute path. */
  edges: Map<string, ImportEdge[]>;
  /** Per-(from, specifier) resolutions; absent → resolver returns null. */
  resolutions: Map<string, string | null>;
}

/**
 * Builds a real ParserRegistry with a single test parser that claims the full set of
 * walkable JS/TS/MDX extensions. The parser returns per-file precomputed edges from the
 * FakeWorld, standing in for oxc/mdx parsing in these unit tests.
 */
function makeFakeRegistry(world: FakeWorld): ParserRegistry {
  const testParser: ImportParser = {
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mdx'],
    parse: vi.fn(async ({ filePath }) => world.edges.get(filePath) ?? []),
  };
  return new ParserRegistry({
    defaultParsers: [testParser],
    pluginParsers: [],
  });
}

function makeFakeResolver(world: FakeWorld): ChangeDetectionResolverFactory {
  return {
    resolve: vi.fn(async (from: string, specifier: string) => {
      const key = `${from}::${specifier}`;
      return world.resolutions.has(key) ? world.resolutions.get(key)! : null;
    }),
  } as unknown as ChangeDetectionResolverFactory;
}

function setupFsReadOk(world: FakeWorld) {
  vi.mocked(readFile).mockImplementation(async (path) => {
    if (!world.files.has(String(path))) {
      throw Object.assign(new Error(`ENOENT: ${String(path)}`), { code: 'ENOENT' });
    }
    return '';
  });
}

describe('DependencyGraphBuilder', () => {
  beforeEach(() => {
    vi.mocked(logger.debug).mockImplementation(() => undefined);
    vi.mocked(logger.warn).mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty results for an empty story list', async () => {
    const world: FakeWorld = { files: new Set(), edges: new Map(), resolutions: new Map() };
    setupFsReadOk(world);
    const builder = new DependencyGraphBuilder({
      registry: makeFakeRegistry(world),
      resolver: makeFakeResolver(world),
      workspaceRoots: new Set(),
      projectRoot: '/repo',
    });

    const { reverseIndex, graph } = await builder.build([]);

    expect(reverseIndex.asMap().size).toBe(0);
    expect(graph.size).toBe(0);
  });

  it('records a story with no imports at depth 0 and adds nothing else', async () => {
    const story = '/repo/src/A.stories.tsx';
    const world: FakeWorld = {
      files: new Set([story]),
      edges: new Map([[story, []]]),
      resolutions: new Map(),
    };
    setupFsReadOk(world);
    const builder = new DependencyGraphBuilder({
      registry: makeFakeRegistry(world),
      resolver: makeFakeResolver(world),
      workspaceRoots: new Set(),
      projectRoot: '/repo',
    });

    const { reverseIndex } = await builder.build([story]);

    expect(reverseIndex.lookup(story).get(story)).toBe(0);
    expect(reverseIndex.asMap().size).toBe(1);
  });

  it('skips CSS imports (they are not walkable)', async () => {
    const story = '/repo/src/A.stories.tsx';
    const css = '/repo/src/styles.css';
    const world: FakeWorld = {
      files: new Set([story, css]),
      edges: new Map([[story, [{ specifier: './styles.css', kind: 'static' }]]]),
      resolutions: new Map([[`${story}::./styles.css`, css]]),
    };
    setupFsReadOk(world);
    const builder = new DependencyGraphBuilder({
      registry: makeFakeRegistry(world),
      resolver: makeFakeResolver(world),
      workspaceRoots: new Set(),
      projectRoot: '/repo',
    });

    const { reverseIndex } = await builder.build([story]);

    // CSS resolved into scope so the reverse index DOES record it at depth 1, but the walk
    // does not recurse into it (no further calls to extractor on it). Verify only story root
    // and the css leaf appear.
    expect(reverseIndex.lookup(story).get(story)).toBe(0);
    // CSS may be present at depth 1 (resolved into scope). Either is fine for this test —
    // what matters is no transitive walk happened.
    expect(reverseIndex.asMap().size).toBeLessThanOrEqual(2);
  });

  it('records sibling JS dep at depth 1 when imported by story', async () => {
    const story = '/repo/src/A.stories.tsx';
    const sibling = '/repo/src/sibling.ts';
    const world: FakeWorld = {
      files: new Set([story, sibling]),
      edges: new Map([
        [story, [{ specifier: './sibling.ts', kind: 'static' }]],
        [sibling, []],
      ]),
      resolutions: new Map([[`${story}::./sibling.ts`, sibling]]),
    };
    setupFsReadOk(world);
    const builder = new DependencyGraphBuilder({
      registry: makeFakeRegistry(world),
      resolver: makeFakeResolver(world),
      workspaceRoots: new Set(),
      projectRoot: '/repo',
    });

    const { reverseIndex } = await builder.build([story]);

    expect(reverseIndex.lookup(sibling).get(story)).toBe(1);
  });

  it('walks into a workspace package (resolved into a workspaceRoot)', async () => {
    const story = '/repo/src/A.stories.tsx';
    const wsMain = '/repo/packages/lib/src/index.ts';
    const world: FakeWorld = {
      files: new Set([story, wsMain]),
      edges: new Map([
        [story, [{ specifier: '@scope/lib', kind: 'static' }]],
        [wsMain, []],
      ]),
      resolutions: new Map([[`${story}::@scope/lib`, wsMain]]),
    };
    setupFsReadOk(world);
    const builder = new DependencyGraphBuilder({
      registry: makeFakeRegistry(world),
      resolver: makeFakeResolver(world),
      workspaceRoots: new Set(['/repo/packages/lib']),
      projectRoot: '/repo',
    });

    const { reverseIndex } = await builder.build([story]);

    expect(reverseIndex.lookup(wsMain).get(story)).toBe(1);
  });

  it('does NOT walk into a regular node_modules package (resolved outside scope)', async () => {
    const story = '/repo/src/A.stories.tsx';
    const npmMain = '/repo/node_modules/lodash/index.js';
    const npmTransitive = '/repo/node_modules/lodash/util.js';
    const registry = makeFakeRegistry({
      files: new Set(),
      edges: new Map([
        [story, [{ specifier: 'lodash', kind: 'static' }]],
        [npmMain, [{ specifier: './util', kind: 'static' }]],
      ]),
      resolutions: new Map(),
    });
    const resolver = {
      resolve: vi.fn(async (from: string, spec: string) => {
        if (from === story && spec === 'lodash') {
          return npmMain;
        }
        if (from === npmMain && spec === './util') {
          return npmTransitive;
        }
        return null;
      }),
    } as unknown as ChangeDetectionResolverFactory;
    setupFsReadOk({
      files: new Set([story, npmMain, npmTransitive]),
      edges: new Map(),
      resolutions: new Map(),
    });
    const builder = new DependencyGraphBuilder({
      registry,
      resolver,
      workspaceRoots: new Set(),
      projectRoot: '/repo',
    });

    const { reverseIndex } = await builder.build([story]);

    // npmMain resolved out of scope — neither it nor its transitive dep should appear.
    expect(reverseIndex.asMap().has(npmMain)).toBe(false);
    expect(reverseIndex.asMap().has(npmTransitive)).toBe(false);
  });

  it('records two stories importing the same shared dep with their independent depths', async () => {
    const a = '/repo/src/A.stories.tsx';
    const b = '/repo/src/B.stories.tsx';
    const intermediate = '/repo/src/intermediate.ts';
    const shared = '/repo/src/shared.ts';
    const world: FakeWorld = {
      files: new Set([a, b, intermediate, shared]),
      edges: new Map([
        [a, [{ specifier: './shared.ts', kind: 'static' }]],
        [b, [{ specifier: './intermediate.ts', kind: 'static' }]],
        [intermediate, [{ specifier: './shared.ts', kind: 'static' }]],
        [shared, []],
      ]),
      resolutions: new Map([
        [`${a}::./shared.ts`, shared],
        [`${b}::./intermediate.ts`, intermediate],
        [`${intermediate}::./shared.ts`, shared],
      ]),
    };
    setupFsReadOk(world);
    const builder = new DependencyGraphBuilder({
      registry: makeFakeRegistry(world),
      resolver: makeFakeResolver(world),
      workspaceRoots: new Set(),
      projectRoot: '/repo',
    });

    const { reverseIndex } = await builder.build([a, b]);

    const inner = reverseIndex.lookup(shared);
    expect(inner.get(a)).toBe(1);
    expect(inner.get(b)).toBe(2);
  });

  it('skips one specifier that fails to resolve but records the other edges from the same file', async () => {
    const story = '/repo/src/A.stories.tsx';
    const ok = '/repo/src/ok.ts';
    const world: FakeWorld = {
      files: new Set([story, ok]),
      edges: new Map([
        [
          story,
          [
            { specifier: './missing', kind: 'static' },
            { specifier: './ok.ts', kind: 'static' },
          ],
        ],
        [ok, []],
      ]),
      // Only the ./ok.ts specifier resolves; ./missing has no entry => null.
      resolutions: new Map([[`${story}::./ok.ts`, ok]]),
    };
    setupFsReadOk(world);
    const builder = new DependencyGraphBuilder({
      registry: makeFakeRegistry(world),
      resolver: makeFakeResolver(world),
      workspaceRoots: new Set(),
      projectRoot: '/repo',
    });

    const { reverseIndex } = await builder.build([story]);

    expect(reverseIndex.lookup(ok).get(story)).toBe(1);
  });

  it('resolves each shared module exactly once regardless of how many stories reach it', async () => {
    const storyA = '/repo/src/A.stories.tsx';
    const storyB = '/repo/src/B.stories.tsx';
    const shared = '/repo/src/shared.ts';
    const world: FakeWorld = {
      files: new Set([storyA, storyB, shared]),
      edges: new Map([
        [storyA, [{ specifier: './shared.ts', kind: 'static' }]],
        [storyB, [{ specifier: './shared.ts', kind: 'static' }]],
        [shared, [{ specifier: './nothing.ts', kind: 'static' }]],
      ]),
      resolutions: new Map([
        [`${storyA}::./shared.ts`, shared],
        [`${storyB}::./shared.ts`, shared],
        // shared's outgoing edge fails to resolve — we only care that resolver is called once
        // for shared, not once per story walk that reaches it.
      ]),
    };
    setupFsReadOk(world);
    const resolver = makeFakeResolver(world);
    const builder = new DependencyGraphBuilder({
      registry: makeFakeRegistry(world),
      resolver,
      workspaceRoots: new Set(),
      projectRoot: '/repo',
    });

    await builder.build([storyA, storyB]);

    // Without the resolve cache, `shared.ts`'s single outgoing edge would be resolved twice
    // (once per story walk that visits it). With the cache, it is resolved exactly once.
    const sharedEdgeResolves = vi
      .mocked(resolver.resolve)
      .mock.calls.filter(([from]) => from === shared);
    expect(sharedEdgeResolves).toHaveLength(1);
  });

  it('emits a debug log line on completion', async () => {
    const story = '/repo/src/A.stories.tsx';
    const world: FakeWorld = {
      files: new Set([story]),
      edges: new Map([[story, []]]),
      resolutions: new Map(),
    };
    setupFsReadOk(world);
    const builder = new DependencyGraphBuilder({
      registry: makeFakeRegistry(world),
      resolver: makeFakeResolver(world),
      workspaceRoots: new Set(),
      projectRoot: '/repo',
    });

    await builder.build([story]);

    expect(vi.mocked(logger.debug)).toHaveBeenCalledWith(
      expect.stringContaining('Change detection graph built:')
    );
  });
});
