// Tests for ParseResolveCache focusing on the multi-hop barrel chain-following logic.
// The registry parser and parseBarrelInfo are stubbed; readFile returns empty strings so
// the stubs own all edge/barrel decisions.  No oxc binary is needed.
import { afterEach, describe, expect, it, vi } from 'vitest';

import { readFile } from 'node:fs/promises';

import * as oxcParser from 'storybook/internal/oxc-parser';

import { ParserRegistry } from '../parser-registry/parser-registry.ts';
import type { ImportEdge, ImportParser } from '../parser-registry/types.ts';
import { ParseResolveCache } from './parse-resolve-cache.ts';
import type { ChangeDetectionResolverFactory } from './resolver-factory.ts';

vi.mock('node:fs/promises', { spy: true });
vi.mock('storybook/internal/oxc-parser', { spy: true });

type Resolutions = Map<string, string | null>;
type BarrelInfoMap = Map<string, oxcParser.BarrelInfo>;
type EdgesMap = Map<string, ImportEdge[]>;

function makeRegistry(edges: EdgesMap): ParserRegistry {
  const parser: ImportParser = {
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
    parse: vi.fn(async ({ filePath }) => edges.get(filePath) ?? []),
  };
  return new ParserRegistry({ defaultParsers: [parser], pluginParsers: [] });
}

function makeResolver(resolutions: Resolutions): ChangeDetectionResolverFactory {
  return {
    resolve: vi.fn(async (from: string, specifier: string) => {
      const key = `${from}::${specifier}`;
      return resolutions.has(key) ? resolutions.get(key)! : null;
    }),
  } as unknown as ChangeDetectionResolverFactory;
}

const logger = { debug: vi.fn(), warn: vi.fn() };

function makeCache(opts: {
  edges: EdgesMap;
  resolutions: Resolutions;
  barrelInfos: BarrelInfoMap;
  projectRoot?: string;
  workspaceRoots?: Set<string>;
}): ParseResolveCache {
  vi.mocked(readFile).mockImplementation(async () => '');
  vi.mocked(oxcParser.parseBarrelInfo).mockImplementation(async (filePath) => {
    return opts.barrelInfos.get(filePath) ?? { named: new Map(), wildcards: [] };
  });
  return new ParseResolveCache({
    registry: makeRegistry(opts.edges),
    resolver: makeResolver(opts.resolutions),
    workspaceRoots: opts.workspaceRoots ?? new Set(),
    projectRoot: opts.projectRoot ?? '/repo',
    logger,
  });
}

describe('ParseResolveCache — multi-hop barrel following', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('resolves a name through named → wildcard → named chain to the leaf source file', async () => {
    // Barrel A:  export { Link, LinkBase } from './Link'         ← named
    // Barrel B:  export * from './components/Link'              ← wildcard
    // Barrel C:  export { Link } from './Link.tsx'              ← named
    // Link.tsx:  defines Link (no re-exports)
    const barrelA = '/repo/lib/ui/index.ts';
    const barrelB = '/repo/lib/ui/Link/index.ts';
    const barrelC = '/repo/lib/ui/Link/components/Link/index.ts';
    const linkTsx = '/repo/lib/ui/Link/components/Link/Link.tsx';
    const story = '/repo/story.tsx';

    const cache = makeCache({
      edges: new Map([
        [story, [{ specifier: '@ui', importedNames: new Set(['Link']), kind: 'static' }]],
      ]),
      resolutions: new Map([
        [`${story}::@ui`, barrelA],
        [`${barrelA}::./Link`, barrelB],
        [`${barrelB}::./components/Link`, barrelC],
        [`${barrelC}::./Link.tsx`, linkTsx],
      ]),
      barrelInfos: new Map([
        [
          barrelA,
          {
            named: new Map([
              ['Link', { specifier: './Link', importedName: 'Link' }],
              ['LinkBase', { specifier: './Link', importedName: 'LinkBase' }],
            ]),
            wildcards: [],
          },
        ],
        [barrelB, { named: new Map(), wildcards: ['./components/Link'] }],
        [
          barrelC,
          {
            named: new Map([['Link', { specifier: './Link.tsx', importedName: 'Link' }]]),
            wildcards: [],
          },
        ],
        [linkTsx, { named: new Map(), wildcards: [] }],
      ]),
    });

    const deps = await cache.resolveOnce(story);

    // All traversed barrels are in deps so structural re-export changes at any hop
    // invalidate this importer via the reverse index.
    expect(deps).toEqual(new Set([linkTsx, barrelA, barrelB, barrelC]));
    expect(deps.has(barrelA)).toBe(true);
    expect(deps.has(barrelB)).toBe(true);
    expect(deps.has(barrelC)).toBe(true);
  });

  it('does not include LinkBase.tsx when story only imports Link', async () => {
    // Both symbols live in the same intermediate barrel B. Only Link is requested.
    const barrelA = '/repo/lib/ui/index.ts';
    const barrelB = '/repo/lib/ui/Link/index.ts';
    const linkTsx = '/repo/lib/ui/Link/Link.tsx';
    const linkBaseTsx = '/repo/lib/ui/Link/LinkBase.tsx';
    const story = '/repo/story.tsx';

    const cache = makeCache({
      edges: new Map([
        [story, [{ specifier: '@ui', importedNames: new Set(['Link']), kind: 'static' }]],
      ]),
      resolutions: new Map([
        [`${story}::@ui`, barrelA],
        [`${barrelA}::./Link`, barrelB],
        [`${barrelB}::./Link.tsx`, linkTsx],
        [`${barrelB}::./LinkBase.tsx`, linkBaseTsx],
      ]),
      barrelInfos: new Map([
        [
          barrelA,
          {
            named: new Map([
              ['Link', { specifier: './Link', importedName: 'Link' }],
              ['LinkBase', { specifier: './Link', importedName: 'LinkBase' }],
            ]),
            wildcards: [],
          },
        ],
        [
          barrelB,
          {
            named: new Map([
              ['Link', { specifier: './Link.tsx', importedName: 'Link' }],
              ['LinkBase', { specifier: './LinkBase.tsx', importedName: 'LinkBase' }],
            ]),
            wildcards: [],
          },
        ],
        [linkTsx, { named: new Map(), wildcards: [] }],
        [linkBaseTsx, { named: new Map(), wildcards: [] }],
      ]),
    });

    const deps = await cache.resolveOnce(story);

    expect(deps.has(linkTsx)).toBe(true);
    expect(deps.has(linkBaseTsx)).toBe(false);
  });

  it('falls back to including the barrel when the name is not found anywhere in the chain', async () => {
    const barrelA = '/repo/lib/ui/index.ts';
    const story = '/repo/story.tsx';

    const cache = makeCache({
      edges: new Map([
        [story, [{ specifier: '@ui', importedNames: new Set(['NonExistent']), kind: 'static' }]],
      ]),
      resolutions: new Map([[`${story}::@ui`, barrelA]]),
      barrelInfos: new Map([
        [
          barrelA,
          {
            named: new Map([['Button', { specifier: './Button.tsx', importedName: 'Button' }]]),
            wildcards: [],
          },
        ],
      ]),
    });

    const deps = await cache.resolveOnce(story);

    expect(deps.has(barrelA)).toBe(true);
  });

  it('handles cyclic barrel re-exports without infinite looping', async () => {
    const barrelA = '/repo/lib/a/index.ts';
    const barrelB = '/repo/lib/b/index.ts';
    const story = '/repo/story.tsx';

    const cache = makeCache({
      edges: new Map([
        [story, [{ specifier: '@ui', importedNames: new Set(['Foo']), kind: 'static' }]],
      ]),
      resolutions: new Map([
        [`${story}::@ui`, barrelA],
        [`${barrelA}::../b`, barrelB],
        [`${barrelB}::../a`, barrelA],
      ]),
      barrelInfos: new Map([
        [barrelA, { named: new Map(), wildcards: ['../b'] }],
        [barrelB, { named: new Map(), wildcards: ['../a'] }],
      ]),
    });

    const deps = await cache.resolveOnce(story);

    // Cycle detected → needBarrel=true → barrel A added as conservative fallback
    expect(deps.has(barrelA)).toBe(true);
  });

  it('resolves a name that the barrel re-exports as export type { ... }', async () => {
    // Barrel: export { Link } from './Link'; export type { ButtonType } from './types'
    // Story imports { Link, ButtonType } without the `type` keyword.
    // ButtonType must be followed to types.ts even though it's a type re-export.
    const barrel = '/repo/lib/ui/index.ts';
    const linkTsx = '/repo/lib/ui/Link.tsx';
    const typesTsx = '/repo/lib/ui/types.ts';
    const story = '/repo/story.tsx';

    const cache = makeCache({
      edges: new Map([
        [
          story,
          [{ specifier: '@ui', importedNames: new Set(['Link', 'ButtonType']), kind: 'static' }],
        ],
      ]),
      resolutions: new Map([
        [`${story}::@ui`, barrel],
        [`${barrel}::./Link.tsx`, linkTsx],
        [`${barrel}::./types.ts`, typesTsx],
      ]),
      barrelInfos: new Map([
        [
          barrel,
          {
            named: new Map([
              ['Link', { specifier: './Link.tsx', importedName: 'Link' }],
              // type re-export — parseBarrelInfo must include it
              ['ButtonType', { specifier: './types.ts', importedName: 'ButtonType' }],
            ]),
            wildcards: [],
          },
        ],
        [linkTsx, { named: new Map(), wildcards: [] }],
        [typesTsx, { named: new Map(), wildcards: [] }],
      ]),
    });

    const deps = await cache.resolveOnce(story);

    expect(deps.has(linkTsx)).toBe(true);
    expect(deps.has(typesTsx)).toBe(true);
    expect(deps.has(barrel)).toBe(true);
  });

  it('stops at MAX_DEPTH and falls back to needBarrel when chain exceeds 10 hops', async () => {
    // 12 barrels chained via wildcards; Foo lives at the end (hop 11), past the limit.
    const story = '/repo/story.tsx';
    const barrels = Array.from({ length: 12 }, (_, i) => `/repo/lib/barrel${i}/index.ts`);

    const resolutions: Resolutions = new Map([[`${story}::@ui`, barrels[0]]]);
    const barrelInfos: BarrelInfoMap = new Map();

    for (let i = 0; i < barrels.length - 1; i++) {
      resolutions.set(`${barrels[i]}::./next`, barrels[i + 1]);
      barrelInfos.set(barrels[i], { named: new Map(), wildcards: ['./next'] });
    }
    barrelInfos.set(barrels[barrels.length - 1], {
      named: new Map([['Foo', { specifier: './Foo.tsx', importedName: 'Foo' }]]),
      wildcards: [],
    });
    resolutions.set(`${barrels[barrels.length - 1]}::./Foo.tsx`, '/repo/lib/Foo.tsx');

    const cache = makeCache({
      edges: new Map([
        [story, [{ specifier: '@ui', importedNames: new Set(['Foo']), kind: 'static' }]],
      ]),
      resolutions,
      barrelInfos,
    });

    const deps = await cache.resolveOnce(story);

    // Chain too deep — Foo.tsx not reachable; falls back to including barrel[0]
    expect(deps.has(barrels[0])).toBe(true);
    expect(deps.has('/repo/lib/Foo.tsx')).toBe(false);
  });
});
