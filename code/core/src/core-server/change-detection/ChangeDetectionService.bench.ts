/**
 * Synthesized-fixture benchmarks for change-detection hot paths.
 *
 * Generates a temp directory with N story files, each a linear chain of D dep modules, then
 * benchmarks (1) the cold dependency-graph build and (2) a single `IncrementalPatcher.patch`
 * round-trip on a warm graph. The warm-patch bench pre-builds the graph once and reuses it
 * across iterations so the bench measures only the patch path.
 *
 * Run: `yarn vitest bench --run --project=core code/core/src/core-server/change-detection`.
 *
 * Default CI matrix is capped at N=500/D=3. Set `STORYBOOK_CD_BENCH_BIG=1` locally for the
 * worst-case matrix (N=5000/D=10), which takes several minutes.
 */
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { bench, describe } from 'vitest';

import {
  ChangeDetectionResolverFactory,
  DependencyGraphBuilder,
  IncrementalPatcher,
  ParseResolveCache,
} from './dependency-graph/index.ts';
import { ParserRegistry, builtinImportParsers } from './parser-registry/index.ts';
import { getOxcParsePool } from './parser-registry/workers/index.ts';

interface FixtureSpec {
  N: number;
  D: number;
  /**
   * Number of shared modules every story also imports from. Models a component library
   * where all stories import from a small pool of shared components. Defaults to 0
   * (each story has only its own private chain).
   */
  shared?: number;
}

interface Fixture {
  dir: string;
  storyFiles: string[];
  patchTarget: string;
}

const SILENT_LOGGER = { debug: () => {}, warn: () => {} };

async function createFixture({ N, D, shared = 0 }: FixtureSpec): Promise<Fixture> {
  const dir = join(tmpdir(), `cd-bench-${N}-${D}-s${shared}-${process.pid}-${Date.now()}`);
  await mkdir(dir, { recursive: true });

  const storyFiles: string[] = [];
  const writes: Array<Promise<void>> = [];

  // Shared-library modules imported by every story. Each shared module also imports two
  // other shared modules, so the shared subgraph is not a trivial leaf set — this matches
  // real component libraries where Button imports Icon, Icon imports styles, etc.
  for (let s = 0; s < shared; s++) {
    const filePath = join(dir, `shared-${s}.ts`);
    const imports: string[] = [];
    if (shared >= 2) {
      const a = (s + 1) % shared;
      const b = (s + 3) % shared;
      if (a !== s) imports.push(`import { value as sa } from './shared-${a}.ts';`);
      if (b !== s && b !== a) imports.push(`import { value as sb } from './shared-${b}.ts';`);
    }
    const valueExpr = imports.length > 0 ? `${s} + (sa ?? 0) + (sb ?? 0)` : String(s);
    writes.push(
      writeFile(
        filePath,
        [
          ...imports,
          `export const value = ${valueExpr};`,
          `export type Foo = number;`,
          `export function helper(x: number): number { return x * 2 + ${s}; }`,
          '',
        ].join('\n')
      )
    );
  }

  for (let i = 0; i < N; i++) {
    const storyPath = join(dir, `story-${i}.stories.ts`);
    storyFiles.push(storyPath);

    const sharedImports: string[] = [];
    for (let s = 0; s < shared; s++) {
      sharedImports.push(`import { value as shared${s} } from './shared-${s}.ts';`);
    }

    writes.push(
      writeFile(
        storyPath,
        [
          `import { value } from './dep-${i}-0.ts';`,
          `import type { Foo } from './dep-${i}-0.ts';`,
          ...sharedImports,
          `export default { title: 'Story${i}' };`,
          `export const Primary = { args: { value } };`,
          `export type Alias = Foo;`,
          '',
        ].join('\n')
      )
    );

    for (let d = 0; d < D; d++) {
      const filePath = join(dir, `dep-${i}-${d}.ts`);
      const isLeaf = d === D - 1;
      const nextImport = isLeaf ? '' : `import { value as next } from './dep-${i}-${d + 1}.ts';\n`;
      const valueExpr = isLeaf ? String(i * 100 + d) : 'next + 1';
      writes.push(
        writeFile(
          filePath,
          [
            nextImport + `export const value = ${valueExpr};`,
            `export type Foo = number;`,
            `export function helper(x: number): number { return x * 2 + ${d}; }`,
            `export const arr = [1, 2, 3, 4, 5];`,
            '',
          ].join('\n')
        )
      );
    }
  }

  await Promise.all(writes);

  return { dir, storyFiles, patchTarget: join(dir, 'dep-0-0.ts') };
}

function makeRegistry(): ParserRegistry {
  return new ParserRegistry({ defaultParsers: builtinImportParsers, pluginParsers: [] });
}

function makeResolver(dir: string): ChangeDetectionResolverFactory {
  return new ChangeDetectionResolverFactory({ projectRoot: dir });
}

function makeBuilder(dir: string): DependencyGraphBuilder {
  return new DependencyGraphBuilder({
    registry: makeRegistry(),
    resolver: makeResolver(dir),
    workspaceRoots: new Set(),
    projectRoot: dir,
    concurrency: 16,
    logger: SILENT_LOGGER,
  });
}

const CI_MATRIX: FixtureSpec[] = [
  { N: 50, D: 1 },
  { N: 50, D: 3 },
  { N: 500, D: 1 },
  { N: 500, D: 3 },
  // Shared-deps scenario modelling a component library: 500 stories, each with its own
  // 3-deep private chain, ALSO all importing from a pool of 20 shared modules (which
  // themselves import each other). Exercises the resolver-cache hot path — without the
  // cache, each shared module is resolved once per story walk = 10,000 redundant calls.
  { N: 500, D: 3, shared: 20 },
];
const BIG_MATRIX: FixtureSpec[] = [
  { N: 5000, D: 1 },
  { N: 5000, D: 10 },
];

const MATRIX =
  process.env.STORYBOOK_CD_BENCH_BIG === '1' ? [...CI_MATRIX, ...BIG_MATRIX] : CI_MATRIX;

if (process.env.STORYBOOK_CHANGE_DETECTION_REQUIRE_WORKER === '1') {
  // Hard-fail when callers expect the worker pool to be active. Without this guard, a
  // missing compiled `dist/oxc-worker.js` silently falls back to inline parsing and the
  // bench numbers no longer reflect the worker path the dev-server uses.
  const pool = getOxcParsePool();
  if (!pool) {
    throw new Error(
      'STORYBOOK_CHANGE_DETECTION_REQUIRE_WORKER=1 but the oxc worker pool is unavailable. ' +
        'Run `yarn nx compile core` first, or unset the variable to allow inline-parse fallback.'
    );
  }
}

// Lazy per-spec fixture + patcher caches. `beforeAll` hooks do not run reliably under
// `vitest bench` (at vitest 4.1.0), so set-up happens on the first bench iteration for each
// spec via a promise cache.
const fixturePromises = new Map<string, Promise<Fixture>>();
function getFixture(spec: FixtureSpec): Promise<Fixture> {
  const key = `N${spec.N}-D${spec.D}-s${spec.shared ?? 0}`;
  let p = fixturePromises.get(key);
  if (!p) {
    p = createFixture(spec);
    fixturePromises.set(key, p);
  }
  return p;
}

interface WarmContext {
  patcher: IncrementalPatcher;
  patchTarget: string;
}

const warmContexts = new Map<string, Promise<WarmContext>>();
async function getWarmContext(spec: FixtureSpec): Promise<WarmContext> {
  const key = `N${spec.N}-D${spec.D}-s${spec.shared ?? 0}`;
  let p = warmContexts.get(key);
  if (!p) {
    p = (async () => {
      const fixture = await getFixture(spec);
      const registry = makeRegistry();
      const resolver = makeResolver(fixture.dir);
      // Share the parse/resolve cache so the warm-patch bench measures the cache-hit
      // path the dev-server actually exercises after cold-start.
      const cache = new ParseResolveCache({
        registry,
        resolver,
        workspaceRoots: new Set(),
        projectRoot: fixture.dir,
        logger: SILENT_LOGGER,
      });
      const builder = new DependencyGraphBuilder({
        registry,
        resolver,
        workspaceRoots: new Set(),
        projectRoot: fixture.dir,
        concurrency: 16,
        logger: SILENT_LOGGER,
        cache,
      });
      const { reverseIndex, graph } = await builder.build(fixture.storyFiles);
      const storyFilesSet = new Set(fixture.storyFiles);
      const patcher = new IncrementalPatcher({
        reverseIndex,
        graph,
        registry,
        resolver,
        workspaceRoots: new Set(),
        projectRoot: fixture.dir,
        isStoryFile: (path) => storyFilesSet.has(path),
        logger: SILENT_LOGGER,
        cache,
      });
      return { patcher, patchTarget: fixture.patchTarget };
    })();
    warmContexts.set(key, p);
  }
  return p;
}

// Best-effort cleanup on Node exit.
process.on('beforeExit', async () => {
  await Promise.all(
    Array.from(fixturePromises.values()).map(async (p) => {
      try {
        const f = await p;
        await rm(f.dir, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    })
  );
});

for (const spec of MATRIX) {
  const { N, D, shared = 0 } = spec;
  const label =
    shared > 0
      ? `change-detection N=${N} D=${D} shared=${shared}`
      : `change-detection N=${N} D=${D}`;
  describe(label, () => {
    bench(
      'cold build',
      async () => {
        const fixture = await getFixture(spec);
        const builder = makeBuilder(fixture.dir);
        await builder.build(fixture.storyFiles);
      },
      { time: 2000 }
    );

    bench(
      'patch (change) on warm graph',
      async () => {
        const { patcher, patchTarget } = await getWarmContext(spec);
        await patcher.patch({ kind: 'change', path: patchTarget });
      },
      { time: 2000 }
    );
  });
}
