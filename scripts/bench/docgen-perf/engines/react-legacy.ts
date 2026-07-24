/**
 * Series harness for the legacy React docgen engines: `react-docgen` (the budgeted legacy control)
 * and `react-docgen-typescript` (measurable, no budget row). Same shape as the docgen-memory
 * harness: generate a project, one timed cold pass, then per-save touch + invalidate + re-extract
 * with memory sampling around forced GC.
 *
 * Both engines cache per file for the life of the process and expose only global invalidation, so
 * every simulated save calls the global invalidation first - skipping it would measure a cache hit.
 * The react-docgen-typescript parser additionally keys its TS program off `process.cwd()`, so this
 * harness chdirs into the generated project before the first parse.
 *
 * Runs on native Node type stripping - NOT under jiti: react-docgen's browserslist dependency
 * fails on its JSON data require under the jiti loader ("jsReleases.map is not a function").
 *
 * Run:
 *   node --expose-gc scripts/bench/docgen-perf/engines/react-legacy.ts \
 *     --parser react-docgen --components 300 --saves 20 --json /tmp/result.json
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { SANDBOX_DIRECTORY } from '../paths.ts';
import { componentSource, generateProject } from '../../docgen-memory/generate-project.ts';
import { gcAvailable, sampleMemory } from '../sampling.ts';
import { leastSquaresSlope, mean } from '../stats.ts';
import type { SaveSample } from '../types.ts';

/**
 * Minimal structural views of the legacy engine modules, kept local so the `scripts` typecheck does
 * not descend into `code/renderers` internals; the real types live in
 * `code/renderers/react/src/componentManifest`.
 */
interface ComponentRefLike {
  componentName: string;
  importName: string;
  localImportName: string;
  importId: string;
  isPackage: boolean;
  path: string;
}

interface ReactDocgenModule {
  getReactDocgen(
    path: string,
    component: ComponentRefLike
  ): { type: 'success' } | { type: 'error'; error: { name: string; message: string } };
}

interface UtilsModule {
  invalidateCache(): void;
}

interface ReactDocgenTypescriptModule {
  parseWithReactDocgenTypescript(filePath: string): Promise<Array<{ exportName?: string }>>;
  invalidateParser(): void;
}

/**
 * Load a `code/renderers/react` module at runtime. The specifier is built with `new URL` so the
 * static `scripts` typecheck does not pull `code/renderers` source into its program.
 */
async function loadRendererModule<T>(relativePath: string): Promise<T> {
  const url = new URL(
    `../../../../code/renderers/react/src/componentManifest/${relativePath}`,
    import.meta.url
  ).href;
  return (await import(url)) as T;
}

type Parser = 'react-docgen' | 'react-docgen-typescript';

interface HarnessOptions {
  parser: Parser;
  components: number;
  variants: number;
  props: number;
  saves: number;
  outDir: string;
  jsonOut?: string;
}

function parseArgs(argv: string[]): HarnessOptions {
  const get = (flag: string, fallback: string) => {
    const idx = argv.indexOf(flag);
    return idx >= 0 && argv[idx + 1] ? argv[idx + 1] : fallback;
  };
  const parser = get('--parser', 'react-docgen');
  if (parser !== 'react-docgen' && parser !== 'react-docgen-typescript') {
    throw new Error(`--parser must be "react-docgen" or "react-docgen-typescript", got "${parser}"`);
  }
  return {
    parser,
    components: Number(get('--components', '300')),
    variants: Number(get('--variants', '4')),
    props: Number(get('--props', '10')),
    saves: Number(get('--saves', '20')),
    outDir: get('--out', path.join(SANDBOX_DIRECTORY, 'docgen-perf', 'react-legacy', 'project')),
    jsonOut: argv.indexOf('--json') >= 0 ? get('--json', '') : undefined,
  };
}

function componentRef(i: number, componentPath: string): ComponentRefLike {
  return {
    componentName: `Comp${i}`,
    importName: `Comp${i}`,
    localImportName: `Comp${i}`,
    importId: `./Comp${i}`,
    isPackage: false,
    path: componentPath,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  console.log(`react-legacy harness (${options.parser})`);
  console.log(
    `  components=${options.components} variants=${options.variants} props=${options.props} saves=${options.saves}`
  );
  if (!gcAvailable()) {
    console.log('  (run with `node --expose-gc` to measure retained heap; continuing without it)');
  }

  const genStart = Date.now();
  const project = generateProject({
    outDir: options.outDir,
    components: options.components,
    variants: options.variants,
    props: options.props,
    heavyTypes: false,
    heavyFactor: 1,
    base64Kb: 0,
    withNodeModules: true,
  });
  console.log(`  generated project in ${Date.now() - genStart}ms at ${project.outDir}`);

  const { invalidateCache } = await loadRendererModule<UtilsModule>('utils.ts');

  let extractOne: (i: number) => Promise<void> | void;
  let invalidate: () => void;

  if (options.parser === 'react-docgen') {
    const { getReactDocgen } = await loadRendererModule<ReactDocgenModule>('reactDocgen.ts');
    extractOne = (i) => {
      const result = getReactDocgen(project.componentPaths[i], componentRef(i, project.componentPaths[i]));
      if (result.type === 'error') {
        throw new Error(`react-docgen failed on Comp${i}: ${result.error.name} ${result.error.message}`);
      }
    };
    invalidate = invalidateCache;
  } else {
    const { parseWithReactDocgenTypescript, invalidateParser } =
      await loadRendererModule<ReactDocgenTypescriptModule>('reactDocgenTypescript.ts');
    // The parser resolves its tsconfig from process.cwd(); point it at the generated project.
    process.chdir(project.outDir);
    extractOne = async (i) => {
      const docs = await parseWithReactDocgenTypescript(project.componentPaths[i]);
      if (docs.length === 0) {
        throw new Error(`react-docgen-typescript returned no docs for Comp${i}`);
      }
    };
    invalidate = () => {
      invalidateParser();
      invalidateCache();
    };
  }

  console.log(`  full extraction over ${options.components} components (cold pass)…`);
  const coldStart = Date.now();
  for (let i = 0; i < options.components; i++) {
    await extractOne(i);
  }
  const coldMs = Date.now() - coldStart;
  console.log(`  cold pass: ${coldMs}ms`);

  const baseline = sampleMemory(true);

  const samples: SaveSample[] = [];
  const extraByComponent = new Array(options.components).fill(options.props);

  for (let save = 1; save <= options.saves; save++) {
    const i = (save - 1) % options.components;
    extraByComponent[i] += 1;
    fs.writeFileSync(project.componentPaths[i], componentSource(i, extraByComponent[i]));
    // Global invalidation is the only surface these engines expose; without it the re-extraction
    // below is a cache hit.
    invalidate();

    const saveStart = Date.now();
    await extractOne(i);
    const durMs = Date.now() - saveStart;

    const mem = sampleMemory(true);
    samples.push({ save, durMs, ...mem });
    console.log(
      `  save ${String(save).padStart(3)}: ${String(durMs).padStart(5)}ms  ` +
        `rss=${mem.rssMb.toFixed(0).padStart(5)}MB  heapUsed=${mem.heapUsedMb.toFixed(0).padStart(5)}MB` +
        (mem.retainedHeapMb !== undefined
          ? `  retained=${mem.retainedHeapMb.toFixed(0).padStart(5)}MB`
          : '')
    );
  }

  const retainedValues = samples
    .map((s) => s.retainedHeapMb)
    .filter((v): v is number => v !== undefined);
  const retainedSlope = retainedValues.length ? leastSquaresSlope(retainedValues) : undefined;
  const retainedGrowth =
    retainedValues.length && baseline.retainedHeapMb !== undefined
      ? (retainedValues.at(-1) as number) - baseline.retainedHeapMb
      : undefined;
  const transients = samples
    .map((s) => (s.retainedHeapMb !== undefined ? s.heapUsedMb - s.retainedHeapMb : undefined))
    .filter((v): v is number => v !== undefined);
  const avgTransient = transients.length ? mean(transients) : undefined;

  console.log('\nsummary');
  console.log(`  cold pass:           ${coldMs}ms`);
  if (avgTransient !== undefined) {
    console.log(`  avg transient/save:  ${avgTransient.toFixed(0)}MB`);
  }
  if (retainedSlope !== undefined && retainedGrowth !== undefined) {
    console.log(`  retained slope:      ${retainedSlope.toFixed(2)}MB/save`);
    console.log(`  retained growth:     ${retainedGrowth.toFixed(0)}MB over ${options.saves} saves`);
  }

  if (options.jsonOut) {
    fs.writeFileSync(
      options.jsonOut,
      JSON.stringify(
        { options, coldMs, baseline, samples, retainedSlope, retainedGrowth, avgTransient },
        null,
        2
      )
    );
    console.log(`  wrote ${options.jsonOut}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
