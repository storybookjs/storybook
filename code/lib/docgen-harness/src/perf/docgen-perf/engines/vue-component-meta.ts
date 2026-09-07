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
import { PIN_OPTION, importPinned } from '../../docgen-shared/pin.ts';
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

/** The canonical install. A pin is an alias of the same package, so these types describe either. */
const PACKAGE = 'vue-component-meta';
type CheckerModule = typeof import('vue-component-meta');
type Checker = ReturnType<CheckerModule['createCheckerByJson']>;

/** Mirrors the production Vite plugin's checker options. */
const CHECKER_OPTIONS: MetaCheckerOptions = {
  forceUseTs: true,
  noDeclarations: true,
  printer: { newLine: 1 },
};

const SCHEMA = VUE_SCHEMA.extend({ pin: z.string().default(PACKAGE) });

/**
 * `--pin` extends the shared Vue table rather than being read out of argv beforehand, so it reaches
 * the same strict parser as every other flag and lands in the options the result JSON records. Each
 * install gets its own scratch directory, so the two runs never share a generated project.
 */
function parseOptions(argv: string[]): VueHarnessOptions & { pin: string } {
  const parsed = parseHarnessOptions<VueOptionsInput & { pin: string }>(
    argv,
    { ...VUE_OPTIONS, ...PIN_OPTION },
    SCHEMA,
    vueToInput
  );
  return { ...parsed, outDir: parsed.outDir ?? vueOutDir(parsed.pin) };
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

async function createEngine(options: VueHarnessOptions, pin: string): Promise<SeriesEngine> {
  const scenario = setUpVueScenario(options);
  const fns = await importPinned<CheckerModule>(pin, PACKAGE);
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
