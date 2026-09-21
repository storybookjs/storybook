/**
 * Series harness for the vue-docgen-api engine - Vue's legacy docgen and still the default
 * (`resolveDocgenOptions` in `code/frameworks/vue3-vite/src/preset.ts`), the Vue equivalent of the
 * react-docgen control.
 *
 * The parser reads from disk on every call and keeps no cache, so one save costs one `parse` and
 * needs no invalidation step.
 *
 * Run from code/lib/docgen-harness:
 *   node --expose-gc src/perf/docgen-perf/engines/vue-docgen-api.ts \
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
 * Member count is reported alongside timing: a parse that resolved nothing is fast for the wrong
 * reason.
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
