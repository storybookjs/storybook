/**
 * Series harness for the vue-component-meta engine - Vue's opt-in successor to vue-docgen-api.
 *
 * The checker never re-stats files on its own; a disk rewrite must be followed by
 * `checker.updateFile(path, content)` (the surface the production Vite plugin drives from HMR) or
 * the re-extraction measures a stale-cache no-op.
 *
 * Checker creation is inside the cold pass because it is part of the engine's first-extraction cost.
 * The `flat` scenario drives `createCheckerByJson` (the production fallback for tsconfig-less
 * projects); the workspace scenarios drive `createChecker` at the deepest package's tsconfig.
 *
 * Run:
 *   node --expose-gc scripts/bench/docgen-perf/engines/vue-component-meta.ts \
 *     --scenario workspace --packages 4 --components-per-package 10 --heavy-lib --json /tmp/result.json
 */
import * as fs from 'node:fs';

import { type MetaCheckerOptions, createChecker, createCheckerByJson } from 'vue-component-meta';

import { type SeriesEngine, harnessMain, runSeriesHarness } from '../../docgen-shared/series.ts';
import {
  type VueHarnessOptions,
  parseVueOptions,
  setUpVueScenario,
  vueBanner,
} from './vue-scenario.ts';

type Checker = ReturnType<typeof createCheckerByJson>;

/** Mirrors the production Vite plugin's checker options. */
const CHECKER_OPTIONS: MetaCheckerOptions = {
  forceUseTs: true,
  noDeclarations: true,
  printer: { newLine: 1 },
};

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
  // Consume the surfaces production consumes so their evaluation cost is inside the measurement.
  return meta.props.length + meta.events.length + meta.slots.length + meta.exposed.length;
}

function createEngine(options: VueHarnessOptions): SeriesEngine {
  const scenario = setUpVueScenario(options);
  let checker: Checker | undefined;
  let measuredPath = scenario.targetPaths[0];

  return {
    async cold() {
      // Checker creation is timed with the cold pass; it is part of first-extraction cost.
      checker =
        options.scenario === 'flat'
          ? createCheckerByJson(scenario.project.outDir, { include: ['**/*'] }, CHECKER_OPTIONS)
          : createChecker(scenario.project.packageConfigPaths[scenario.targetPackage], CHECKER_OPTIONS);
      let members = 0;
      for (const sfcPath of scenario.targetPaths) {
        members += extractOne(checker, sfcPath);
      }
      return members;
    },
    async applySave(save) {
      const mutation = scenario.mutationFor(save);
      fs.writeFileSync(mutation.filePath, mutation.content);
      // The checker does not re-stat on its own; this is the HMR surface the Vite plugin drives.
      checker!.updateFile(mutation.filePath, mutation.content);
      measuredPath = mutation.measuredPath;
    },
    async reextract() {
      return extractOne(checker!, measuredPath);
    },
  };
}

harnessMain(async () => {
  const options = parseVueOptions(process.argv.slice(2), 'vue-component-meta');
  await runSeriesHarness({
    title: `vue-component-meta harness (${options.scenario})`,
    options,
    banner: vueBanner(options),
    saves: options.saves,
    // Both layouts measure one package's worth of components: every component when flat, the
    // deepest package's when not.
    coldLabel: `${options.componentsPerPackage} components, checker creation included`,
    jsonOut: options.jsonOut,
    setup: async () => createEngine(options),
  });
});
