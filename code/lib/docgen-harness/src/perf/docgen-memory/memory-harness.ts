/**
 * Deterministic in-process memory harness for the docgen-server OOM
 * (https://github.com/storybookjs/storybook/issues/35260).
 *
 * Drives the real {@link ComponentMetaManager} against a generated project of N components, then
 * simulates K file saves and samples memory after each one.
 *
 * Two independent failure signals:
 *   - RETAINED growth: post-GC `heapUsed` trend across saves. Rising ⇒ a true leak (memory held
 *     between saves), flat ⇒ transient allocation.
 *   - PEAK pressure: pre-GC `rss` per save. Under `--no-force-gc` and a `--max-old-space-size` cap,
 *     this is what crashes the process when saves outpace GC (the reported OOM).
 *
 * Modes:
 *   --mode refresh  synchronous manager.batchExtract(allEntries) each save. Mirrors the docgen
 *                   open-service "refresh all extracted components" path (server.ts).
 *   --mode live     many per-component batchExtract calls on the shared program, mirroring the
 *                   docs-addon per-edit wave that drives the #35260 OOM. The program-recycle fix
 *                   bounds this path; use --recycle off to assert the OOM still happens without it.
 *
 * Run from code/lib/docgen-harness (diagnose retained vs transient):
 *   node --expose-gc --import jiti/register src/perf/docgen-memory/memory-harness.ts \
 *     --components 800 --saves 25 --mode refresh
 *
 * Run (reproduce the crash / verify the fix):
 *   NODE_OPTIONS=--max_old_space_size=1536 node --expose-gc --import jiti/register \
 *     src/perf/docgen-memory/memory-harness.ts \
 *     --components 800 --props 10 --saves 1 --mode live --heavy --no-force-gc --recycle off   # → OOM
 *   NODE_OPTIONS=--max_old_space_size=1536 node --expose-gc --import jiti/register \
 *     src/perf/docgen-memory/memory-harness.ts \
 *     --components 800 --props 10 --saves 1 --mode live --heavy --no-force-gc --recycle on    # → survives
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import ts from 'typescript';

import { z } from 'zod';

import { countOption, parseHarnessOptions, positiveCountOption } from '../docgen-shared/args.ts';
import { SANDBOX_DIRECTORY } from '../docgen-shared/paths.ts';
import {
  type StoryRefLike,
  loadReactRendererModule,
} from '../docgen-shared/react-renderer-module.ts';
import { MB, gcAvailable } from '../docgen-shared/sampling.ts';
import {
  type SeriesEngine,
  harnessMain,
  printSeriesSummary,
  runSeries,
} from '../docgen-shared/series.ts';
import { leastSquaresSlope } from '../docgen-shared/stats.ts';
import { buildStoryRefs, componentSource, generateProject } from './generate-project.ts';

interface ComponentMetaManagerLike {
  batchExtract(entries: StoryRefLike[]): void;
  onFilesChanged(
    changes: Array<{ filePath: string; type: 'changed' | 'created' | 'deleted' }>
  ): void;
  dispose(): void;
}

type ComponentMetaManagerCtor = new (
  typescript: typeof ts,
  recycleHeapPressureRatio?: number
) => ComponentMetaManagerLike;

const MODES = ['refresh', 'live'] as const;
/**
 * Which entries to re-extract per save: `all` re-extracts every component (the docgen service
 * refreshing on an empty change hint), `changed` re-extracts only the component whose file changed.
 */
const SCOPES = ['all', 'changed'] as const;
/**
 * Which shape of docgen work the run reproduces.
 *
 *   whole-index - cold documents every component, saves walk round-robin. The manifest generator.
 *   first-story - cold documents one component and every save re-extracts it. The docgen server.
 */
const SHAPES = ['whole-index', 'first-story'] as const;
const RECYCLE = ['on', 'off'] as const;

const OPTIONS = {
  components: { type: 'string' },
  variants: { type: 'string' },
  props: { type: 'string' },
  saves: { type: 'string' },
  mode: { type: 'string' },
  scope: { type: 'string' },
  shape: { type: 'string' },
  recycle: { type: 'string' },
  heavy: { type: 'boolean' },
  'heavy-factor': { type: 'string' },
  'base64-kb': { type: 'string' },
  'no-force-gc': { type: 'boolean' },
  out: { type: 'string' },
  reuse: { type: 'boolean' },
  json: { type: 'string' },
} as const;

const SCHEMA = z.object({
  components: countOption(600),
  variants: countOption(4),
  props: countOption(8),
  saves: countOption(25),
  mode: z.enum(MODES).default('refresh'),
  scope: z.enum(SCOPES).default('all'),
  shape: z.enum(SHAPES).default('whole-index'),
  // `Infinity` disables program recycling; `undefined` leaves the product default in place.
  recycleHeapPressureRatio: z
    .enum(RECYCLE)
    .default('on')
    .transform((recycle) => (recycle === 'off' ? Number.POSITIVE_INFINITY : undefined)),
  heavyTypes: z.boolean().default(false),
  heavyFactor: positiveCountOption(1),
  base64Kb: countOption(0),
  forceGc: z.boolean().default(true),
  outDir: z.string().default(path.join(SANDBOX_DIRECTORY, 'docgen-memory-stress')),
  reuse: z.boolean().default(false),
  jsonOut: z.string().optional(),
});

type HarnessOptions = z.infer<typeof SCHEMA>;

function parseOptions(argv: string[]): HarnessOptions {
  return parseHarnessOptions<HarnessOptions>(argv, OPTIONS, SCHEMA, (values) => ({
    ...values,
    recycleHeapPressureRatio: values.recycle,
    heavyTypes: values.heavy,
    forceGc: !values.noForceGc,
    outDir: values.out,
    jsonOut: values.json,
  }));
}

/**
 * Resolved to a file URL and imported dynamically rather than statically, so this package's
 * typecheck does not pull `code/renderers` source into its program.
 */
async function loadComponentMetaManager(): Promise<ComponentMetaManagerCtor> {
  const mod = await loadReactRendererModule<{ ComponentMetaManager: ComponentMetaManagerCtor }>(
    'componentMeta/ComponentMetaManager.ts'
  );
  return mod.ComponentMetaManager;
}

function resolveProject(options: HarnessOptions): ReturnType<typeof generateProject> {
  const outDir = path.resolve(options.outDir);
  const configPath = path.join(outDir, 'tsconfig.json');

  if (options.reuse && fs.existsSync(configPath)) {
    const componentPaths: string[] = [];
    const storyPaths: string[] = [];
    for (let i = 0; i < options.components; i++) {
      componentPaths.push(path.join(outDir, 'src', `Comp${i}`, `Comp${i}.tsx`));
      storyPaths.push(path.join(outDir, 'src', `Comp${i}`, `Comp${i}.stories.tsx`));
    }
    console.log(`  reusing generated project at ${outDir}`);
    return { outDir, configPath, componentPaths, storyPaths };
  }

  const genStart = Date.now();
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
 * Unlike the `--scope all` single-call cold pass (which OOMs within one call regardless of
 * recycling), the recycle check runs between the per-component calls here, so under a heap cap:
 * recycle on sawtooths and survives, `--recycle off` climbs to the cap and OOMs (the negative
 * control the gate asserts).
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
 * The cold pass is the *identical* operation a `scope=all` refresh save performs
 * (extractPropsFromStories over every entry), so an OOM there is the same OOM every refresh-all
 * save would hit.
 */
function refreshEngine(
  manager: ComponentMetaManagerLike,
  entries: StoryRefLike[],
  project: ReturnType<typeof generateProject>,
  options: HarnessOptions
): SeriesEngine {
  // Track how many extra props each component currently has, so each save grows the type.
  const extraByComponent = new Array<number>(options.components).fill(options.props);
  const firstStory = options.shape === 'first-story';
  // Round-robin would document components the cold pass never touched, so retained heap would climb
  // for an honest reason that reads exactly like a leak.
  const changedIndex = (save: number) => (firstStory ? 0 : (save - 1) % options.components);

  return {
    async cold() {
      manager.batchExtract(firstStory ? [entries[0]] : entries);
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
      // Must run after the write, or the program serves a stale snapshot for this file.
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
      `saves=${options.saves} mode=${options.mode} scope=${options.scope} shape=${options.shape} ` +
      `forceGc=${options.forceGc && gcAvailable()}`
  );
  if (options.forceGc && !gcAvailable()) {
    console.log('  (run with `node --expose-gc` to measure retained heap; continuing without it)');
  }

  // Re-extracting everything after a save is the other shape wearing this one's name.
  if (options.shape === 'first-story' && options.scope === 'all') {
    throw new Error('--shape first-story requires --scope changed');
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
    coldLabel:
      options.shape === 'first-story'
        ? `1 of ${entries.length} components`
        : `${entries.length} components`,
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
});
