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

import { SANDBOX_DIRECTORY } from '../../utils/constants.ts';
import { componentSource, generateProject } from './generate-project.ts';

/**
 * Minimal structural view of the entry shape consumed by `ComponentMetaManager.batchExtract`. Kept
 * local so the `scripts` typecheck does not descend into `code/renderers` internals; the real types
 * live in `code/renderers/react/src/componentManifest`.
 */
interface StoryRef {
  storyPath: string;
  component: {
    componentName: string;
    importName: string;
    localImportName: string;
    importId: string;
    isPackage: boolean;
    path: string;
  };
}

interface ComponentMetaManagerLike {
  batchExtract(entries: StoryRef[]): void;
  onFilesChanged(changes: Array<{ filePath: string; type: 'changed' | 'created' | 'deleted' }>): void;
  dispose(): void;
}

type ComponentMetaManagerCtor = new (
  typescript: typeof ts,
  recycleHeapPressureRatio?: number
) => ComponentMetaManagerLike;

/**
 * Load the real `ComponentMetaManager` at runtime. The specifier is built with `new URL` so the
 * static `scripts` typecheck does not pull `code/renderers` source into its program.
 */
async function loadComponentMetaManager(): Promise<ComponentMetaManagerCtor> {
  const url = new URL(
    '../../../code/renderers/react/src/componentManifest/componentMeta/ComponentMetaManager.ts',
    import.meta.url
  ).href;
  const mod = (await import(url)) as { ComponentMetaManager: ComponentMetaManagerCtor };
  return mod.ComponentMetaManager;
}

interface HarnessOptions {
  components: number;
  variants: number;
  props: number;
  saves: number;
  mode: 'refresh' | 'live';
  heavyTypes: boolean;
  heavyFactor: number;
  base64Kb: number;
  /**
   * Which entries to re-extract per save.
   *   all     – re-extract every component each save (the docgen service refreshing all extracted
   *             components on an empty change hint).
   *   changed – re-extract only the component whose file changed.
   */
  scope: 'all' | 'changed';
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

interface Sample {
  save: number;
  rssMb: number;
  heapUsedMb: number;
  retainedHeapMb?: number;
}

const MB = 1024 * 1024;

function parseArgs(argv: string[]): HarnessOptions {
  const get = (flag: string, fallback: string) => {
    const idx = argv.indexOf(flag);
    return idx >= 0 && argv[idx + 1] ? argv[idx + 1] : fallback;
  };
  const mode = get('--mode', 'refresh');
  if (mode !== 'refresh' && mode !== 'live') {
    throw new Error(`--mode must be "refresh" or "live", got "${mode}"`);
  }
  const scope = get('--scope', 'all');
  if (scope !== 'all' && scope !== 'changed') {
    throw new Error(`--scope must be "all" or "changed", got "${scope}"`);
  }
  const recycle = get('--recycle', 'on');
  if (recycle !== 'on' && recycle !== 'off') {
    throw new Error(`--recycle must be "on" or "off", got "${recycle}"`);
  }
  return {
    components: Number(get('--components', '600')),
    variants: Number(get('--variants', '4')),
    props: Number(get('--props', '8')),
    saves: Number(get('--saves', '25')),
    mode,
    scope: scope as 'all' | 'changed',
    recycleHeapPressureRatio: recycle === 'off' ? Number.POSITIVE_INFINITY : undefined,
    heavyTypes: argv.includes('--heavy'),
    heavyFactor: Number(get('--heavy-factor', '1')),
    base64Kb: Number(get('--base64-kb', '0')),
    forceGc: !argv.includes('--no-force-gc'),
    outDir: get('--out', path.join(SANDBOX_DIRECTORY, 'docgen-memory-stress')),
    reuse: argv.includes('--reuse'),
    jsonOut: argv.indexOf('--json') >= 0 ? get('--json', '') : undefined,
    maxRetainedGrowthMb: Number(get('--max-retained-growth', '400')),
  };
}

function gc(): void {
  if (typeof global.gc === 'function') {
    global.gc();
    global.gc();
  }
}

function sampleMemory(forceGc: boolean): { rssMb: number; heapUsedMb: number; retainedHeapMb?: number } {
  const pre = process.memoryUsage();
  let retainedHeapMb: number | undefined;
  if (forceGc) {
    gc();
    retainedHeapMb = process.memoryUsage().heapUsed / MB;
  }
  return { rssMb: pre.rss / MB, heapUsedMb: pre.heapUsed / MB, retainedHeapMb };
}

/** Least-squares slope of `values` vs index, in units-per-save. */
function slopePerSave(values: number[]): number {
  const n = values.length;
  if (n < 2) {
    return 0;
  }
  const meanX = (n - 1) / 2;
  const meanY = values.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - meanX) * (values[i] - meanY);
    den += (i - meanX) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

function buildEntries(componentPaths: string[], storyPaths: string[]): StoryRef[] {
  return componentPaths.map((componentPath, i) => ({
    storyPath: storyPaths[i],
    component: {
      componentName: `Comp${i}`,
      importName: `Comp${i}`,
      localImportName: `Comp${i}`,
      importId: `./Comp${i}`,
      isPackage: false,
      path: componentPath,
    },
  }));
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
 *     the negative control the gate asserts (proving the fix, not the cap, is what prevents the OOM).
 */
function runLiveMode(
  manager: ComponentMetaManagerLike,
  entries: StoryRef[],
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

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const gcAvailable = typeof global.gc === 'function';

  console.log('docgen-memory harness');
  console.log(
    `  components=${options.components} variants=${options.variants} props=${options.props} ` +
      `saves=${options.saves} mode=${options.mode} scope=${options.scope} forceGc=${options.forceGc && gcAvailable}`
  );
  if (options.forceGc && !gcAvailable) {
    console.log('  (run with `node --expose-gc` to measure retained heap; continuing without it)');
  }

  const genStart = Date.now();
  let project: ReturnType<typeof generateProject>;
  if (options.reuse && fs.existsSync(path.join(path.resolve(options.outDir), 'tsconfig.json'))) {
    const outDir = path.resolve(options.outDir);
    const componentPaths: string[] = [];
    const storyPaths: string[] = [];
    for (let i = 0; i < options.components; i++) {
      componentPaths.push(path.join(outDir, 'src', `Comp${i}`, `Comp${i}.tsx`));
      storyPaths.push(path.join(outDir, 'src', `Comp${i}`, `Comp${i}.stories.tsx`));
    }
    project = { outDir, configPath: path.join(outDir, 'tsconfig.json'), componentPaths, storyPaths };
    console.log(`  reusing generated project at ${outDir}`);
  } else {
    project = generateProject({
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
  }

  const ComponentMetaManager = await loadComponentMetaManager();
  const manager = new ComponentMetaManager(ts, options.recycleHeapPressureRatio);
  const entries = buildEntries(project.componentPaths, project.storyPaths);

  if (options.mode === 'live') {
    runLiveMode(manager, entries, options);
    return;
  }

  // Initial extraction — builds the full TS program once (the cold path). This is the *identical*
  // operation a `scope=all` refresh save performs (extractPropsFromStories over every entry), so an
  // OOM here is the same OOM every refresh-all save would hit; it simply lands on the first pass when
  // the full-extraction working set already exceeds the heap cap.
  const initialStart = Date.now();
  console.log(`  full extraction over ${entries.length} components (cold pass == refresh-all save)…`);
  manager.batchExtract(entries);
  console.log(`  initial batchExtract: ${Date.now() - initialStart}ms`);

  const baseline = sampleMemory(options.forceGc && gcAvailable);
  console.log(
    `  baseline: rss=${baseline.rssMb.toFixed(0)}MB heapUsed=${baseline.heapUsedMb.toFixed(0)}MB` +
      (baseline.retainedHeapMb !== undefined
        ? ` retained=${baseline.retainedHeapMb.toFixed(0)}MB`
        : '')
  );

  const samples: Sample[] = [];
  // Track how many extra props each component currently has, so each save grows the type.
  const extraByComponent = new Array(options.components).fill(options.props);

  for (let save = 1; save <= options.saves; save++) {
    const i = (save - 1) % options.components;
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

    const saveStart = Date.now();
    const toExtract = options.scope === 'changed' ? [entries[i]] : entries;
    manager.batchExtract(toExtract);
    const durMs = Date.now() - saveStart;

    const mem = sampleMemory(options.forceGc && gcAvailable);
    samples.push({ save, ...mem });
    console.log(
      `  save ${String(save).padStart(3)}: ${String(durMs).padStart(5)}ms  ` +
        `rss=${mem.rssMb.toFixed(0).padStart(5)}MB  heapUsed=${mem.heapUsedMb.toFixed(0).padStart(5)}MB` +
        (mem.retainedHeapMb !== undefined
          ? `  retained=${mem.retainedHeapMb.toFixed(0).padStart(5)}MB`
          : '')
    );
  }

  manager.dispose();

  const rssValues = samples.map((s) => s.rssMb);
  const peakRss = Math.max(baseline.rssMb, ...rssValues);
  const finalRss = rssValues.at(-1) ?? baseline.rssMb;
  const rssSlope = slopePerSave(rssValues);

  const retainedValues = samples
    .map((s) => s.retainedHeapMb)
    .filter((v): v is number => v !== undefined);
  const retainedSlope = retainedValues.length ? slopePerSave(retainedValues) : undefined;
  const retainedGrowth =
    retainedValues.length && baseline.retainedHeapMb !== undefined
      ? (retainedValues.at(-1) as number) - baseline.retainedHeapMb
      : undefined;

  const transients = samples
    .map((s) => (s.retainedHeapMb !== undefined ? s.heapUsedMb - s.retainedHeapMb : undefined))
    .filter((v): v is number => v !== undefined);
  const avgTransient = transients.length
    ? transients.reduce((a, b) => a + b, 0) / transients.length
    : undefined;

  console.log('\nsummary');
  console.log(`  peak rss:            ${peakRss.toFixed(0)}MB`);
  if (avgTransient !== undefined) {
    console.log(`  avg transient/save:  ${avgTransient.toFixed(0)}MB (pre-GC heapUsed − post-GC heapUsed)`);
  }
  console.log(`  final rss:           ${finalRss.toFixed(0)}MB`);
  console.log(`  rss slope:           ${rssSlope.toFixed(1)}MB/save`);
  if (retainedSlope !== undefined) {
    console.log(`  retained slope:      ${retainedSlope.toFixed(2)}MB/save (post-GC heapUsed)`);
    console.log(`  retained growth:     ${retainedGrowth!.toFixed(0)}MB over ${options.saves} saves`);
    console.log(
      retainedGrowth! > 5
        ? '  → classification:    RETAINED leak (memory held between saves)'
        : '  → classification:    TRANSIENT pressure (post-GC heap flat; OOM is GC-can\'t-keep-up)'
    );
  }

  if (options.jsonOut) {
    fs.writeFileSync(
      options.jsonOut,
      JSON.stringify(
        { options, baseline, samples, peakRss, finalRss, rssSlope, retainedSlope, retainedGrowth, avgTransient },
        null,
        2
      )
    );
    console.log(`  wrote ${options.jsonOut}`);
  }

  if (retainedGrowth !== undefined && retainedGrowth > options.maxRetainedGrowthMb) {
    console.error(
      `\nFAIL: retained growth ${retainedGrowth.toFixed(0)}MB exceeds threshold ${options.maxRetainedGrowthMb}MB`
    );
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
