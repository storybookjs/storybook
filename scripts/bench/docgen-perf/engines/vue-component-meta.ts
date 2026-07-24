/**
 * Series harness for the vue-component-meta engine. Same shape as the docgen-memory harness:
 * generate a project, one timed cold pass (checker creation included - it is part of the engine's
 * first-extraction cost), then per-save touch + invalidate + re-extract with memory sampling.
 *
 * The checker never re-stats files on its own; a disk rewrite must be followed by
 * `checker.updateFile(path, content)` (the surface the production Vite plugin drives from HMR) or
 * the re-extraction measures a stale-cache no-op.
 *
 * Scenarios:
 *   flat             single package, checker over the project root (`createCheckerByJson`, the
 *                    production fallback for tsconfig-less projects); saves touch components
 *                    round-robin.
 *   workspace        packages/* layout; the checker is driven at the deepest package's tsconfig
 *                    (`createChecker`); saves touch that package's components round-robin.
 *   base-type-touch  workspace layout; every save touches the widely-imported base type instead,
 *                    then re-extracts one fixed dependent component, so each sample pays the wide
 *                    checker invalidation.
 *
 * Run:
 *   node --expose-gc scripts/bench/docgen-perf/engines/vue-component-meta.ts \
 *     --scenario workspace --packages 4 --components-per-package 10 --heavy-lib --json /tmp/result.json
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import {
  type MetaCheckerOptions,
  createChecker,
  createCheckerByJson,
} from 'vue-component-meta';

import { SANDBOX_DIRECTORY } from '../paths.ts';
import { baseTypesSource, generateVueProject, vueComponentSource } from '../generators/vue.ts';
import { gcAvailable, sampleMemory } from '../sampling.ts';
import { leastSquaresSlope, mean } from '../stats.ts';
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

/** Mirrors the production Vite plugin's checker options. */
const CHECKER_OPTIONS: MetaCheckerOptions = {
  forceUseTs: true,
  noDeclarations: true,
  printer: { newLine: 1 },
};

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
    outDir: get('--out', path.join(SANDBOX_DIRECTORY, 'docgen-perf', 'vue-component-meta', 'project')),
    jsonOut: argv.indexOf('--json') >= 0 ? get('--json', '') : undefined,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const flat = options.scenario === 'flat';
  const packages = flat ? 1 : options.packages;

  console.log(`vue-component-meta harness (${options.scenario})`);
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

  // The measured set: every component in flat layout, the deepest package's components otherwise
  // (their prop types pull the whole cross-package chain).
  const targetPackage = packages - 1;
  const targetPaths = flat
    ? project.componentPaths
    : project.componentPaths.slice(-options.componentsPerPackage);

  const extractOne = (checker: ReturnType<typeof createCheckerByJson>, sfcPath: string) => {
    const exportNames = checker.getExportNames(sfcPath);
    if (!exportNames.includes('default')) {
      throw new Error(`no default export found in ${sfcPath} (got: ${exportNames.join(', ') || 'none'})`);
    }
    const meta = checker.getComponentMeta(sfcPath, 'default');
    // Consume the surfaces production consumes so their evaluation cost is inside the measurement.
    const propCount = meta.props.length + meta.events.length + meta.slots.length + meta.exposed.length;
    if (meta.props.length === 0) {
      throw new Error(`vue-component-meta returned zero props for ${sfcPath}`);
    }
    return propCount;
  };

  // Cold pass: checker creation is part of the engine's first-extraction cost.
  console.log(`  full extraction over ${targetPaths.length} components (cold pass, checker included)…`);
  const coldStart = Date.now();
  const checker = flat
    ? createCheckerByJson(project.outDir, { include: ['**/*'] }, CHECKER_OPTIONS)
    : createChecker(project.packageConfigPaths[targetPackage], CHECKER_OPTIONS);
  for (const sfcPath of targetPaths) {
    extractOne(checker, sfcPath);
  }
  const coldMs = Date.now() - coldStart;
  console.log(`  cold pass: ${coldMs}ms`);

  const baseline = sampleMemory(true);

  const samples: SaveSample[] = [];
  const extraByTarget = new Array(targetPaths.length).fill(0);
  let extraBaseProps = 0;

  for (let save = 1; save <= options.saves; save++) {
    let measuredPath: string;
    if (options.scenario === 'base-type-touch') {
      // Touch the widely-imported base type; every dependent package's props type changes.
      extraBaseProps += 1;
      const content = baseTypesSource(options.fanOut, extraBaseProps);
      fs.writeFileSync(project.baseTypesPath, content);
      checker.updateFile(project.baseTypesPath, content);
      // Re-extract one fixed dependent - the first component of the deepest package - so each
      // sample pays the wide invalidation.
      measuredPath = targetPaths[0];
    } else {
      const t = (save - 1) % targetPaths.length;
      extraByTarget[t] += 1;
      const content = vueComponentSource(targetPackage, t, extraByTarget[t]);
      fs.writeFileSync(targetPaths[t], content);
      checker.updateFile(targetPaths[t], content);
      measuredPath = targetPaths[t];
    }

    const saveStart = Date.now();
    extractOne(checker, measuredPath);
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
