/**
 * Deterministic in-process memory harness for the docgen-server OOM
 * (https://github.com/storybookjs/storybook/issues/35260).
 *
 * It reproduces the "re-extract on every save" behavior without a browser or dev server, so it runs
 * fast and is fully deterministic. It drives the real {@link ComponentMetaManager} against a
 * generated project of N components, then simulates K file saves and samples memory after each one.
 *
 * Two failure signals are measured independently:
 *   - RETAINED growth: post-GC `heapUsed` trend across saves. A rising trend ⇒ a true leak (memory
 *     held between saves). A flat trend ⇒ the cost is transient allocation, not retained state.
 *   - PEAK pressure: pre-GC `rss` per save. With `--no-force-gc` and a `--max-old-space-size` cap at
 *     launch, this is what crashes the process when saves outpace GC (the reported OOM).
 *
 * Modes:
 *   --mode refresh  call manager.batchExtract(allEntries) synchronously each save. Mirrors the docgen
 *                   open-service "refresh all extracted components" path (server.ts).
 *   --mode live     many per-component batchExtract calls on the shared program, mirroring the
 *                   docs-addon per-edit wave that drives the #35260 OOM. The program-recycle fix bounds
 *                   this path. Use --recycle off to assert the OOM still happens without the fix.
 *
 * Run (diagnose retained vs transient):
 *   node --expose-gc --import jiti/register scripts/bench/docgen-memory/memory-harness.ts \
 *     --components 800 --saves 25 --mode refresh
 *
 * Run (reproduce the crash / verify the fix):
 *   NODE_OPTIONS=--max_old_space_size=1536 node --expose-gc --import jiti/register \
 *     scripts/bench/docgen-memory/memory-harness.ts \
 *     --components 800 --props 10 --saves 1 --mode live --heavy --no-force-gc --recycle off   # → OOM
 *   NODE_OPTIONS=--max_old_space_size=1536 node --expose-gc --import jiti/register \
 *     scripts/bench/docgen-memory/memory-harness.ts \
 *     --components 800 --props 10 --saves 1 --mode live --heavy --no-force-gc --recycle on    # → survives
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import ts from 'typescript';

import { Args } from '../docgen-shared/args.ts';
import { SANDBOX_DIRECTORY } from '../docgen-shared/paths.ts';
import {
  type StoryRefLike,
  buildStoryRefs,
  loadRendererModule,
} from '../docgen-shared/renderer-module.ts';
import { MB, gcAvailable } from '../docgen-shared/sampling.ts';
import {
  type SeriesEngine,
  harnessMain,
  printSeriesSummary,
  runSeries,
} from '../docgen-shared/series.ts';
import { leastSquaresSlope } from '../docgen-shared/stats.ts';
import { componentSource, generateProject } from './generate-project.ts';

interface ComponentMetaManagerLike {
  batchExtract(entries: StoryRefLike[]): void;
  onFilesChanged(changes: Array<{ filePath: string; type: 'changed' | 'created' | 'deleted' }>): void;
  dispose(): void;
}

type ComponentMetaManagerCtor = new (
  typescript: typeof ts,
  recycleHeapPressureRatio?: number
) => ComponentMetaManagerLike;

const MODES = ['refresh', 'live'] as const;
/**
 * Which entries to re-extract per save.
 *   all     - re-extract every component each save (the docgen service refreshing all extracted
 *             components on an empty change hint).
 *   changed - re-extract only the component whose file changed.
 */
const SCOPES = ['all', 'changed'] as const;
const RECYCLE = ['on', 'off'] as const;

interface HarnessOptions {
  components: number;
  variants: number;
  props: number;
  saves: number;
  mode: (typeof MODES)[number];
  heavyTypes: boolean;
  heavyFactor: number;
  base64Kb: number;
  scope: (typeof SCOPES)[number];
  forceGc: boolean;
  outDir: string;
  reuse: boolean;
  jsonOut?: string;
  /** Fail the process when post-GC retained growth exceeds this many MB across the run. */
  maxRetainedGrowthMb: number;
  /**
   * Heap-pressure ratio forwarded to `ComponentMetaManager`. `Infinity` disables program recycling
   * (the negative control: assert the OOM happens without the fix). `undefined` uses the product
   * default.
   */
  recycleHeapPressureRatio?: number;
}

function parseOptions(argv: string[]): HarnessOptions {
  const args = new Args(argv);
  return {
    components: args.count('components', 600),
    variants: args.count('variants', 4),
    props: args.count('props', 8),
    saves: args.count('saves', 25),
    mode: args.choice('mode', MODES, 'refresh'),
    scope: args.choice('scope', SCOPES, 'all'),
    recycleHeapPressureRatio:
      args.choice('recycle', RECYCLE, 'on') === 'off' ? Number.POSITIVE_INFINITY : undefined,
    heavyTypes: args.flag('heavy'),
    heavyFactor: args.count('heavy-factor', 1),
    base64Kb: args.count('base64-kb', 0),
    forceGc: !args.flag('no-force-gc'),
    outDir: args.string('out', path.join(SANDBOX_DIRECTORY, 'docgen-memory-stress')),
    reuse: args.flag('reuse'),
    jsonOut: args.optional('json'),
    maxRetainedGrowthMb: args.count('max-retained-growth', 400),
  };
}

/**
 * Load the real `ComponentMetaManager` at runtime. The specifier is built with `new URL` so the
 * static `scripts` typecheck does not pull `code/renderers` source into its program.
 */
async function loadComponentMetaManager(): Promise<ComponentMetaManagerCtor> {
  const mod = await loadRendererModule<{ ComponentMetaManager: ComponentMetaManagerCtor }>(
    'componentMeta/ComponentMetaManager.ts'
  );
  return mod.ComponentMetaManager;
}

function resolveProject(options: HarnessOptions): ReturnType<typeof generateProject> {
  const genStart = Date.now();
  if (options.reuse && fs.existsSync(path.join(path.resolve(options.outDir), 'tsconfig.json'))) {
    const outDir = path.resolve(options.outDir);
    const componentPaths: string[] = [];
    const storyPaths: string[] = [];
    for (let i = 0; i < options.components; i++) {
      componentPaths.push(path.join(outDir, 'src', `Comp${i}`, `Comp${i}.tsx`));
      storyPaths.push(path.join(outDir, 'src', `Comp${i}`, `Comp${i}.stories.tsx`));
    }
    console.log(`  reusing generated project at ${outDir}`);
    return { outDir, configPath: path.join(outDir, 'tsconfig.json'), componentPaths, storyPaths };
  }
  const project = generateProject({
    outDir: options.outDir,
    components: options.components,
    variants: options.variants,
    props: options.props,
    heavyTypes: options.heavyTypes,
    heavyFactor: options.heavyFactor,
    base64Kb: options.base64Kb,
    withNodeModules: true,
  });
  console.log(`  generated project in ${Date.now() - genStart}ms at ${project.outDir}`);
  return project;
}

/**
 * Live-path mode: mirrors the docs-addon per-edit "waves" that drive the #35260 OOM — many
 * individual per-component `batchExtract` calls on the ONE shared program, whose type-resolution
 * cache accumulates across calls. This is the exact shape the program-recycle fix bounds (the
 * recycle check runs between calls), unlike the `--scope all` single-call cold pass which OOMs
 * within one call regardless of recycling.
 *
 * Run under a `--max-old-space-size` cap:
 *   - recycle on (default): the heap sawtooths as the shared program is recycled, and survives.
 *   - `--recycle off` (ratio Infinity): the type cache climbs to the cap and the process OOMs —
 *     the negative control the gate asserts.
 */
function runLiveMode(
  manager: ComponentMetaManagerLike,
  entries: StoryRefLike[],
  options: HarnessOptions
): void {
  const recycleEnabled = options.recycleHeapPressureRatio === undefined;
  console.log(
    `  live mode: ${options.saves} wave(s) × ${entries.length} per-component extractions, ` +
      `recycle=${recycleEnabled ? 'on' : 'OFF (negative control)'}`
  );

  let peakRss = 0;
  let extractions = 0;

  for (let wave = 1; wave <= options.saves; wave++) {
    for (let i = 0; i < entries.length; i++) {
      manager.batchExtract([entries[i]]);
      extractions++;
      peakRss = Math.max(peakRss, process.memoryUsage().rss / MB);
    }
    const rssMb = process.memoryUsage().rss / MB;
    console.log(
      `  wave ${String(wave).padStart(2)}: rss=${rssMb.toFixed(0).padStart(5)}MB  ` +
        `peak=${peakRss.toFixed(0).padStart(5)}MB  (${extractions} extractions)`
    );
  }

  manager.dispose();

  console.log('\nsummary');
  console.log(`  result:   survived (no OOM) over ${extractions} extractions`);
  console.log(`  peak rss: ${peakRss.toFixed(0)}MB`);

  if (options.jsonOut) {
    fs.writeFileSync(
      options.jsonOut,
      JSON.stringify({ options, mode: 'live', survived: true, peakRss, extractions }, null, 2)
    );
    console.log(`  wrote ${options.jsonOut}`);
  }
}

/**
 * Refresh-path mode as a save series. The cold pass is the *identical* operation a `scope=all`
 * refresh save performs (extractPropsFromStories over every entry), so an OOM there is the same OOM
 * every refresh-all save would hit; it simply lands on the first pass when the full-extraction
 * working set already exceeds the heap cap.
 */
function refreshEngine(
  manager: ComponentMetaManagerLike,
  entries: StoryRefLike[],
  project: ReturnType<typeof generateProject>,
  options: HarnessOptions
): SeriesEngine {
  // Track how many extra props each component currently has, so each save grows the type.
  const extraByComponent = new Array<number>(options.components).fill(options.props);
  const changedIndex = (save: number) => (save - 1) % options.components;

  return {
    async cold() {
      manager.batchExtract(entries);
      return undefined;
    },
    async applySave(save) {
      const i = changedIndex(save);
      const componentPath = project.componentPaths[i];
      // Mutate the component's props interface on disk so the type genuinely changes.
      extraByComponent[i] += 1;
      fs.writeFileSync(
        componentPath,
        componentSource(i, extraByComponent[i], {
          heavyTypes: options.heavyTypes,
          heavyFactor: options.heavyFactor,
          base64Kb: options.base64Kb,
        })
      );
      // Bump project versions so the next extraction re-reads the mutated file (matches the dev
      // server's file-watcher → onFilesChanged flow); without this the program serves stale snapshots.
      manager.onFilesChanged([{ filePath: componentPath, type: 'changed' }]);
    },
    async reextract(save) {
      manager.batchExtract(options.scope === 'changed' ? [entries[changedIndex(save)]] : entries);
      return undefined;
    },
    dispose: () => manager.dispose(),
  };
}

harnessMain(async () => {
  const options = parseOptions(process.argv.slice(2));

  console.log('docgen-memory harness');
  console.log(
    `  components=${options.components} variants=${options.variants} props=${options.props} ` +
      `saves=${options.saves} mode=${options.mode} scope=${options.scope} ` +
      `forceGc=${options.forceGc && gcAvailable()}`
  );
  if (options.forceGc && !gcAvailable()) {
    console.log('  (run with `node --expose-gc` to measure retained heap; continuing without it)');
  }

  const project = resolveProject(options);
  const ComponentMetaManager = await loadComponentMetaManager();
  const manager = new ComponentMetaManager(ts, options.recycleHeapPressureRatio);
  const entries = buildStoryRefs(project.componentPaths, project.storyPaths);

  if (options.mode === 'live') {
    runLiveMode(manager, entries, options);
    return;
  }

  const series = await runSeries(refreshEngine(manager, entries, project, options), {
    saves: options.saves,
    coldLabel: `${entries.length} components`,
    forceGc: options.forceGc,
  });

  const rssValues = series.samples.map((s) => s.rssMb);
  const peakRss = Math.max(series.baseline.rssMb, ...rssValues);
  const finalRss = rssValues.at(-1) ?? series.baseline.rssMb;
  const rssSlope = leastSquaresSlope(rssValues);
  const { retainedGrowth } = series;

  printSeriesSummary(series, options.saves);
  console.log(`  peak rss:            ${peakRss.toFixed(0)}MB`);
  console.log(`  final rss:           ${finalRss.toFixed(0)}MB`);
  console.log(`  rss slope:           ${rssSlope.toFixed(1)}MB/save`);
  if (retainedGrowth !== undefined) {
    console.log(
      retainedGrowth > 5
        ? '  → classification:    RETAINED leak (memory held between saves)'
        : "  → classification:    TRANSIENT pressure (post-GC heap flat; OOM is GC-can't-keep-up)"
    );
  }

  if (options.jsonOut) {
    fs.writeFileSync(
      options.jsonOut,
      JSON.stringify({ options, ...series, peakRss, finalRss, rssSlope }, null, 2)
    );
    console.log(`  wrote ${options.jsonOut}`);
  }

  if (retainedGrowth !== undefined && retainedGrowth > options.maxRetainedGrowthMb) {
    console.error(
      `\nFAIL: retained growth ${retainedGrowth.toFixed(0)}MB exceeds threshold ${options.maxRetainedGrowthMb}MB`
    );
    process.exitCode = 1;
  }
});
