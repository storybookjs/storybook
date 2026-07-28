/**
 * Series harness for the vue-docgen-api engine - Vue's legacy docgen and still the default one
 * (`resolveDocgenOptions` in `code/frameworks/vue3-vite/src/preset.ts`). It is the legacy half of the
 * Vue control pair, the way react-docgen is for React.
 *
 * Production calls `parse(id)` once per `.vue` file from a Vite `transform` hook
 * (`code/frameworks/vue3-vite/src/plugins/vue-docgen.ts`), and the parser reads the file from disk
 * on every call with no cache of its own. A save therefore costs exactly one `parse` of one file,
 * so the per-save sample is production-shaped without any invalidation step.
 *
 * The generated project and the save sequence come from the shared scenario module, so they are
 * identical to the ones vue-component-meta measures.
 *
 * Run:
 *   node --expose-gc scripts/bench/docgen-perf/engines/vue-docgen-api.ts \
 *     --scenario workspace --packages 4 --components-per-package 10 --heavy-lib --json /tmp/result.json
 */
import * as fs from 'node:fs';

import { parse } from 'vue-docgen-api';

import { type SeriesEngine, harnessMain, runSeriesHarness } from '../../docgen-shared/series.ts';
import {
  type VueHarnessOptions,
  parseVueOptions,
  setUpVueScenario,
  vueBanner,
} from './vue-scenario.ts';

/**
 * How many documented members the parse produced. The two Vue engines resolve imported prop types
 * to different depths, so a timing ratio is only meaningful next to this count - a parse that
 * resolved nothing is fast for the wrong reason.
 */
async function extractOne(sfcPath: string): Promise<number> {
  const doc = await parse(sfcPath);
  return (
    Object.keys(doc.props ?? {}).length +
    Object.keys(doc.events ?? {}).length +
    Object.keys(doc.slots ?? {}).length +
    Object.keys(doc.expose ?? {}).length
  );
}

function createEngine(options: VueHarnessOptions): SeriesEngine {
  const scenario = setUpVueScenario(options);
  let measuredPath = scenario.targetPaths[0];

  return {
    async cold() {
      let members = 0;
      for (const sfcPath of scenario.targetPaths) {
        members += await extractOne(sfcPath);
      }
      return members;
    },
    async applySave(save) {
      const mutation = scenario.mutationFor(save);
      fs.writeFileSync(mutation.filePath, mutation.content);
      measuredPath = mutation.measuredPath;
    },
    async reextract() {
      return extractOne(measuredPath);
    },
  };
}

harnessMain(async () => {
  const options = parseVueOptions(process.argv.slice(2), 'vue-docgen-api');
  await runSeriesHarness({
    title: `vue-docgen-api harness (${options.scenario})`,
    options,
    banner: vueBanner(options),
    saves: options.saves,
    coldLabel: `${options.componentsPerPackage} components`,
    jsonOut: options.jsonOut,
    setup: async () => createEngine(options),
  });
});
