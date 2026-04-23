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
} from './dependency-graph/index.ts';
import { ParserRegistry, builtinImportParsers } from './parser-registry/index.ts';

interface FixtureSpec {
  N: number;
  D: number;
}

interface Fixture {
  dir: string;
  storyFiles: string[];
  patchTarget: string;
}

const SILENT_LOGGER = { debug: () => {}, warn: () => {} };

async function createFixture({ N, D }: FixtureSpec): Promise<Fixture> {
  const dir = join(tmpdir(), `cd-bench-${N}-${D}-${process.pid}-${Date.now()}`);
  await mkdir(dir, { recursive: true });

  const storyFiles: string[] = [];
  const writes: Array<Promise<void>> = [];

  for (let i = 0; i < N; i++) {
    const storyPath = join(dir, `story-${i}.stories.ts`);
    storyFiles.push(storyPath);
    writes.push(
      writeFile(
        storyPath,
        [
          `import { value } from './dep-${i}-0.ts';`,
          `import type { Foo } from './dep-${i}-0.ts';`,
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
];
const BIG_MATRIX: FixtureSpec[] = [
  { N: 5000, D: 1 },
  { N: 5000, D: 10 },
];

const MATRIX =
  process.env.STORYBOOK_CD_BENCH_BIG === '1' ? [...CI_MATRIX, ...BIG_MATRIX] : CI_MATRIX;

// Lazy per-spec fixture + patcher caches. `beforeAll` hooks do not run reliably under
// `vitest bench` (at vitest 4.1.0), so set-up happens on the first bench iteration for each
// spec via a promise cache.
const fixturePromises = new Map<string, Promise<Fixture>>();
function getFixture(spec: FixtureSpec): Promise<Fixture> {
  const key = `N${spec.N}-D${spec.D}`;
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
  const key = `N${spec.N}-D${spec.D}`;
  let p = warmContexts.get(key);
  if (!p) {
    p = (async () => {
      const fixture = await getFixture(spec);
      const registry = makeRegistry();
      const resolver = makeResolver(fixture.dir);
      const builder = new DependencyGraphBuilder({
        registry,
        resolver,
        workspaceRoots: new Set(),
        projectRoot: fixture.dir,
        concurrency: 16,
        logger: SILENT_LOGGER,
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
  const { N, D } = spec;
  describe(`change-detection N=${N} D=${D}`, () => {
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
