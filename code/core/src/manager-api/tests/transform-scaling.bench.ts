/**
 * Performance showcase (bench): per-call cost of `transformStoryIndexToStoriesHash` at scale.
 *
 * Context: `setIndex` (`code/core/src/manager-api/modules/stories.ts:786-809`) runs this
 * transform TWICE per call, and `fullStatusStore.onAllStatusChange` (stories.ts:1290) triggers
 * setIndex on EVERY status event — on this branch twice per event (once via
 * `recomputeStatusFilter` -> `experimental_setFilter` -> `setIndex`, once directly), i.e. 4 full
 * transform passes per status event. PR #35429 halves that to 2. The companion characterization
 * test (`set-index-transforms.perf-showcase.test.ts`) pins those invocation counts.
 *
 * This bench shows the price each of those redundant passes pays as the index grows: full-index
 * transform time at 1,000 / 5,000 / 10,000 entries with empty filters. A per-story status stream
 * (e.g. a test run reporting 10,000 stories one by one) multiplies this cost by 4 per event on
 * the manager main thread.
 *
 * Run: yarn vitest bench --run code/core/src/manager-api/tests/transform-scaling.bench.ts --project core
 */
import { bench, describe } from 'vitest';

import type { API_PreparedStoryIndex } from 'storybook/internal/types';

import { transformStoryIndexToStoriesHash } from '../lib/stories.ts';

type TransformOptions = Parameters<typeof transformStoryIndexToStoriesHash>[1];

const SIZES = [1_000, 5_000, 10_000];
const STORIES_PER_COMPONENT = 5;

/** Synthetic v5 index in the same shape as the `navigationEntries` fixture, at scale. */
function makeIndex(count: number): API_PreparedStoryIndex {
  const entries: API_PreparedStoryIndex['entries'] = {};
  for (let i = 0; i < count; i += 1) {
    const component = Math.floor(i / STORIES_PER_COMPONENT);
    const story = i % STORIES_PER_COMPONENT;
    const id = `perf-component-${component}--story-${story}`;
    entries[id] = {
      type: 'story',
      subtype: 'story',
      id,
      title: `perf/component-${component}`,
      name: `story ${story}`,
      importPath: `./perf/component-${component}.ts`,
    };
  }
  return { v: 5, entries };
}

function makeOptions(): TransformOptions {
  return {
    provider: { getConfig: () => ({}) } as unknown as TransformOptions['provider'],
    docsOptions: {},
    filters: {},
    allStatuses: {},
  };
}

// One-off deterministic-input measurement so the magnitude is visible in the output without
// digging through bench tables: best-of-5 wall time and entries/ms per size.
for (const size of SIZES) {
  const index = makeIndex(size);
  const options = makeOptions();
  transformStoryIndexToStoriesHash(index, options); // warmup
  const runs: number[] = [];
  for (let i = 0; i < 5; i += 1) {
    const start = performance.now();
    transformStoryIndexToStoriesHash(index, options);
    runs.push(performance.now() - start);
  }
  const best = Math.min(...runs);
   
  console.log(
    `[perf-showcase] transformStoryIndexToStoriesHash: ${size} entries in ${best.toFixed(2)}ms ` +
      `(best of 5) = ${Math.round(size / best)} entries/ms — ` +
      `x4 per status event on this branch (x2 after PR #35429)`
  );
}

describe('transformStoryIndexToStoriesHash scaling (cost paid by every setIndex pass)', () => {
  for (const size of SIZES) {
    const index = makeIndex(size);
    const options = makeOptions();
    bench(`${size} entries, empty filters`, () => {
      transformStoryIndexToStoriesHash(index, options);
    });
  }
});
