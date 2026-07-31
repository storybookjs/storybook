/**
 * Series harness for the vue-component-meta engine - Vue's opt-in successor to vue-docgen-api.
 *
 * The checker never re-stats files on its own; a disk rewrite must be followed by
 * `checker.updateFile(path, content)` or the re-extraction measures a stale-cache no-op. Checker
 * creation runs inside the cold pass, since it is part of first-extraction cost: `flat` uses
 * `createCheckerByJson`, the workspace scenarios use `createChecker` on the deepest package.
 *
 * Run from code/lib/docgen-harness:
 *   node --expose-gc src/perf/docgen-perf/engines/vue-component-meta.ts \
 *     --scenario workspace --packages 4 --components-per-package 10 --heavy-lib --json /tmp/result.json
 */
import * as fs from 'node:fs';

import type { MetaCheckerOptions } from 'vue-component-meta';
import { z } from 'zod';

import { parseHarnessOptions } from '../../docgen-shared/args.ts';
import { type SeriesEngine, harnessMain, runSeriesHarness } from '../../docgen-shared/series.ts';
import {
  VUE_OPTIONS,
  VUE_SCHEMA,
  type VueHarnessOptions,
  type VueOptionsInput,
  setUpVueScenario,
  vueBanner,
  vueOutDir,
  vueToInput,
} from './vue-scenario.ts';

/** Both pins are the same package, so the current one's types describe either install. */
type CheckerModule = typeof import('vue-component-meta');
type Checker = ReturnType<CheckerModule['createCheckerByJson']>;

/** Mirrors the production Vite plugin's checker options. */
const CHECKER_OPTIONS: MetaCheckerOptions = {
  forceUseTs: true,
  noDeclarations: true,
  printer: { newLine: 1 },
};

const PINS = ['current', 'next'] as const;
type Pin = (typeof PINS)[number];

/** Each pin is a separate install, so each gets its own scratch directory. */
const PIN_DIR: Record<Pin, string> = {
  current: 'vue-component-meta',
  next: 'vue-component-meta-next',
};

/**
 * `--pin` is this harness's only flag of its own, so it extends the shared Vue table rather than
 * being read out of argv beforehand: it is validated by the same strict parser as every other flag,
 * accepts `--pin=next` like they do, and lands in the options the result JSON records.
 */
const SCHEMA = VUE_SCHEMA.extend({ pin: z.enum(PINS).default('current') });

function parseOptions(argv: string[]): VueHarnessOptions & { pin: Pin } {
  const parsed = parseHarnessOptions<VueOptionsInput & { pin: Pin }>(
    argv,
    { ...VUE_OPTIONS, pin: { type: 'string' } },
    SCHEMA,
    vueToInput
  );
  return { ...parsed, outDir: parsed.outDir ?? vueOutDir(PIN_DIR[parsed.pin]) };
}

/**
 * Only the pin being measured is loaded. Importing both copies would leave the other one's module
 * graph on the heap of every run, including the runs that feed the standing vue pair, which would
 * shift a memory number that has nothing to do with this comparison.
 */
function loadCheckers(pin: Pin): Promise<CheckerModule> {
  return pin === 'next' ? import('vue-component-meta-next') : import('vue-component-meta');
}

/**
 * Both checker calls stay inside the timed path on purpose, re-extraction included. The production
 * plugin's `transform` hook runs `getExportNames` then `getComponentMeta` on every transform, so
 * hoisting the export lookup into `cold()` would time a sequence Storybook never performs. The
 * vue-docgen-api harness makes one `parse()` call for the same reason - its plugin makes one too -
 * and the cost of that difference is part of what the comparison is for.
 */
function extractOne(checker: Checker, sfcPath: string): number {
  const exportNames = checker.getExportNames(sfcPath);
  if (!exportNames.includes('default')) {
    throw new Error(
      `no default export found in ${sfcPath} (got: ${exportNames.join(', ') || 'none'})`
    );
  }
  const meta = checker.getComponentMeta(sfcPath, 'default');
  if (meta.props.length === 0) {
    throw new Error(`vue-component-meta returned zero props for ${sfcPath}`);
  }
  return meta.props.length + meta.events.length + meta.slots.length + meta.exposed.length;
}

async function createEngine(options: VueHarnessOptions, pin: Pin): Promise<SeriesEngine> {
  const scenario = setUpVueScenario(options);
  const fns = await loadCheckers(pin);
  let checker: Checker | undefined;
  let measuredPath = scenario.targetPaths[0];

  return {
    async cold() {
      checker =
        options.scenario === 'flat'
          ? fns.createCheckerByJson(scenario.project.outDir, { include: ['**/*'] }, CHECKER_OPTIONS)
          : fns.createChecker(
              scenario.project.packageConfigPaths[scenario.targetPackage],
              CHECKER_OPTIONS
            );
      let members = 0;
      for (const sfcPath of scenario.targetPaths) {
        members += extractOne(checker, sfcPath);
      }
      return members;
    },
    async applySave(save) {
      const mutation = scenario.mutationFor(save);
      fs.writeFileSync(mutation.filePath, mutation.content);
      checker!.updateFile(mutation.filePath, mutation.content);
      measuredPath = mutation.measuredPath;
    },
    async reextract() {
      return extractOne(checker!, measuredPath);
    },
  };
}

harnessMain(async () => {
  const options = parseOptions(process.argv.slice(2));
  await runSeriesHarness({
    title: `vue-component-meta harness (${options.scenario}, pin=${options.pin})`,
    options,
    banner: vueBanner(options),
    saves: options.saves,
    coldLabel: `${options.componentsPerPackage} components, checker creation included`,
    jsonOut: options.jsonOut,
    setup: async () => createEngine(options, options.pin),
  });
});
