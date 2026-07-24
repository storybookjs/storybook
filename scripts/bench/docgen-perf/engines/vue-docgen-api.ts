/**
 * Series harness for the vue-docgen-api engine - Vue's legacy docgen and still the default one
 * (`resolveDocgenOptions` in `code/frameworks/vue3-vite/src/preset.ts`). It is the legacy half of the
 * Vue control pair, the way react-docgen is for React.
 *
 * Production calls `parse(id)` once per `.vue` file from a Vite `transform` hook
 * (`code/frameworks/vue3-vite/src/plugins/vue-docgen.ts`), and the parser reads the file from disk
 * on every call with no cache of its own. A save therefore costs exactly one `parse` of one file,
 * so the per-save sample here is production-shaped without any invalidation step.
 *
 * The generated project is the same one the vue-component-meta harness measures, with the same
 * scenario levers, so the two engines' medians divide into a ratio that means something.
 *
 * Run:
 *   node --expose-gc scripts/bench/docgen-perf/engines/vue-docgen-api.ts \
 *     --scenario workspace --packages 4 --components-per-package 10 --heavy-lib --json /tmp/result.json
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { parse } from 'vue-docgen-api';

import { SANDBOX_DIRECTORY } from '../paths.ts';
import { baseTypesSource, generateVueProject, vueComponentSource } from '../generators/vue.ts';
import { gcAvailable, sampleMemory } from '../sampling.ts';
import { summarizeSeries } from '../stats.ts';
import type { SaveSample } from '../types.ts';

type Scenario = 'flat' | 'workspace' | 'base-type-touch';

interface HarnessOptions {
  scenario: Scenario;
  packages: number;
  componentsPerPackage: number;
  chainDepth: number;
  fanOut: number;
  heavyLib: boolean;
  saves: number;
  outDir: string;
  jsonOut?: string;
}

function parseArgs(argv: string[]): HarnessOptions {
  const get = (flag: string, fallback: string) => {
    const idx = argv.indexOf(flag);
    return idx >= 0 && argv[idx + 1] ? argv[idx + 1] : fallback;
  };
  const scenario = get('--scenario', 'workspace');
  if (scenario !== 'flat' && scenario !== 'workspace' && scenario !== 'base-type-touch') {
    throw new Error(`--scenario must be "flat", "workspace" or "base-type-touch", got "${scenario}"`);
  }
  return {
    scenario,
    packages: Number(get('--packages', '4')),
    componentsPerPackage: Number(get('--components-per-package', '10')),
    chainDepth: Number(get('--chain-depth', '3')),
    fanOut: Number(get('--fan-out', '4')),
    heavyLib: argv.includes('--heavy-lib'),
    saves: Number(get('--saves', '15')),
    outDir: get('--out', path.join(SANDBOX_DIRECTORY, 'docgen-perf', 'vue-docgen-api', 'project')),
    jsonOut: argv.indexOf('--json') >= 0 ? get('--json', '') : undefined,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const flat = options.scenario === 'flat';
  const packages = flat ? 1 : options.packages;

  console.log(`vue-docgen-api harness (${options.scenario})`);
  console.log(
    `  packages=${packages} componentsPerPackage=${options.componentsPerPackage} ` +
      `chainDepth=${options.chainDepth} fanOut=${options.fanOut} heavyLib=${options.heavyLib} saves=${options.saves}`
  );
  if (!gcAvailable()) {
    console.log('  (run with `node --expose-gc` to measure retained heap; continuing without it)');
  }

  const genStart = Date.now();
  const project = generateVueProject({
    outDir: options.outDir,
    packages,
    componentsPerPackage: options.componentsPerPackage,
    chainDepth: options.chainDepth,
    fanOut: options.fanOut,
    heavyLib: options.heavyLib,
  });
  console.log(`  generated project in ${Date.now() - genStart}ms at ${project.outDir}`);

  // Same measured set as the vue-component-meta harness: every component in flat layout, the
  // deepest package's components otherwise.
  const targetPackage = packages - 1;
  const targetPaths = flat
    ? project.componentPaths
    : project.componentPaths.slice(-options.componentsPerPackage);

  /**
   * Returns how many documented members the parse produced. The two Vue engines resolve imported
   * prop types to different depths, so a timing ratio is only meaningful next to this count -
   * a parse that resolved nothing is fast for the wrong reason.
   */
  const extractOne = async (sfcPath: string): Promise<number> => {
    const doc = await parse(sfcPath);
    return (
      Object.keys(doc.props ?? {}).length +
      (doc.events ? Object.keys(doc.events).length : 0) +
      (doc.slots ? Object.keys(doc.slots).length : 0) +
      (doc.expose ? Object.keys(doc.expose).length : 0)
    );
  };

  console.log(`  full extraction over ${targetPaths.length} components (cold pass)…`);
  const coldStart = Date.now();
  let coldMembers = 0;
  for (const sfcPath of targetPaths) {
    coldMembers += await extractOne(sfcPath);
  }
  const coldMs = Date.now() - coldStart;
  console.log(`  cold pass: ${coldMs}ms (${coldMembers} documented members)`);

  const baseline = sampleMemory(true);

  const samples: SaveSample[] = [];
  const extraByTarget = new Array(targetPaths.length).fill(0);
  let extraBaseProps = 0;
  let warmMembers = 0;

  for (let save = 1; save <= options.saves; save++) {
    let measuredPath: string;
    if (options.scenario === 'base-type-touch') {
      extraBaseProps += 1;
      fs.writeFileSync(project.baseTypesPath, baseTypesSource(options.fanOut, extraBaseProps));
      measuredPath = targetPaths[0];
    } else {
      const t = (save - 1) % targetPaths.length;
      extraByTarget[t] += 1;
      fs.writeFileSync(targetPaths[t], vueComponentSource(targetPackage, t, extraByTarget[t]));
      measuredPath = targetPaths[t];
    }

    const saveStart = Date.now();
    warmMembers = await extractOne(measuredPath);
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

  const { retainedSlope, retainedGrowth, avgTransient } = summarizeSeries(samples, baseline);

  console.log('\nsummary');
  console.log(`  cold pass:           ${coldMs}ms`);
  console.log(`  documented members:  ${coldMembers} cold, ${warmMembers} on the last save`);
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
        {
          options,
          coldMs,
          coldMembers,
          warmMembers,
          baseline,
          samples,
          retainedSlope,
          retainedGrowth,
          avgTransient,
        },
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
