/**
 * Performance showcase: redundant `transformStoryIndexToStoriesHash` work in `setIndex`.
 *
 * Culprit: `code/core/src/manager-api/modules/stories.ts:786-809` — every `api.setIndex(input)`
 * call runs `transformStoryIndexToStoriesHash` TWICE over the full index: once with the active
 * `filters` (the `filteredIndex` pass) and once with `filters: {}` (the unfiltered `index` pass).
 * The unfiltered pass is a pure function of the index input, yet it is recomputed even when the
 * index is referentially identical to the previous call.
 *
 * Amplification: `fullStatusStore.onAllStatusChange` (stories.ts:1290) reacts to EVERY status
 * event by calling `recomputeStatusFilter()` -> `experimental_setFilter` -> `api.setIndex`, AND
 * then calling `api.setIndex` itself — so on this branch a single status update triggers
 * 2 rebuilds x 2 transforms = 4 full-index transform passes, all over the same index object.
 * PR #35429 removes the handler's own `setIndex` (the `experimental_setFilter` path already
 * rebuilds), halving this to 2 transforms per status event; the redundant unfiltered pass
 * would cut it to 1.
 *
 * At scale (test runs streaming per-story status updates into a 2,000+ story index) this is
 * thousands of O(n) hash rebuilds on the manager main thread.
 *
 * Numbers demonstrated here (deterministic invocation counts on a 2,000-entry index):
 * - 1 `setIndex` call -> exactly 2 transform invocations (1 filtered + 1 unfiltered).
 * - 10 status-store updates -> 20 `setIndex` rebuilds -> 40 transform invocations (4 per status
 *   event), every one receiving the referentially-identical index, and every unfiltered pass
 *   producing a result deep-equal to the previous one (pure redundancy).
 */
import type { Mocked } from 'vitest';
import { describe, expect, it, vi } from 'vitest';

import type { StoryIndex } from 'storybook/internal/types';

import { EventEmitter } from 'events';

import { transformStoryIndexToStoriesHash } from '../lib/stories.ts';
import type { ModuleArgs } from '../lib/types.tsx';
import { init as initStories } from '../modules/stories.ts';
import type { API, State } from '../root.tsx';
import type Store from '../store.ts';
import { fullStatusStore } from '../stores/status.ts';

vi.mock('../stores/status');
vi.mock('../lib/events.ts', () => ({
  getEventMetadata: vi.fn(() => ({ sourceType: 'local' })),
}));
vi.mock('@storybook/global', () => ({
  global: {
    ...globalThis,
    fetch: vi.fn(),
    CONFIG_TYPE: 'DEVELOPMENT',
  },
}));
// Passthrough spies: count invocations of the real transform without changing behavior.
// (A partial factory mock with importOriginal does not propagate to modules/stories.ts in this
// module graph; spy-mode does.)
vi.mock('../lib/stories.ts', { spy: true });

const transformSpy = vi.mocked(transformStoryIndexToStoriesHash);

const ENTRY_COUNT = 2000;
const STORIES_PER_COMPONENT = 5;

/** Synthetic index in the same shape as the `navigationEntries` fixture, at scale. */
function makeSyntheticEntries(count: number): StoryIndex['entries'] {
  const entries: StoryIndex['entries'] = {};
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
  return entries;
}

function createMockStore(initialState: Partial<State> = {}) {
  let state = initialState;
  return {
    getState: vi.fn(() => state),
    setState: vi.fn((s: Partial<State> | ((s: Partial<State>) => Partial<State>)) => {
      if (typeof s === 'function') {
        state = { ...state, ...s(state) };
      } else {
        state = { ...state, ...s };
      }
      return Promise.resolve(state);
    }),
  } as any as Store;
}

function createMockModuleArgs({
  fullAPI = {},
  initialState = {},
}: {
  fullAPI?: Partial<Mocked<API>>;
  initialState?: Partial<State>;
}) {
  const navigate = vi.fn();
  const store = createMockStore({ filters: {}, status: {}, ...initialState });
  const provider = {
    getConfig: vi.fn().mockReturnValue({}),
    channel: new EventEmitter(),
  };

  return { navigate, store, provider, fullAPI: { ...fullAPI, getRefs: () => ({}) } };
}

describe('perf-showcase: setIndex double-transform', () => {
  // Single init shared by both tests: the mocked fullStatusStore is a module-level singleton, so
  // every initStories call would add another onAllStatusChange subscription and skew the counts.
  const moduleArgs = createMockModuleArgs({});
  const { api } = initStories(moduleArgs as unknown as ModuleArgs);
  const index: StoryIndex = { v: 5, entries: makeSyntheticEntries(ENTRY_COUNT) };

  it('runs transformStoryIndexToStoriesHash exactly TWICE for a single setIndex call', async () => {
    transformSpy.mockClear();

    await api.setIndex(index);

    // One rebuild = 2 full-index transform passes over all 2,000 entries.
    expect(transformSpy).toHaveBeenCalledTimes(2);

    const [filteredCall, unfilteredCall] = transformSpy.mock.calls;
    // Pass 1: filtered hash (carries the status filter key).
    expect(filteredCall[1].statusFilterKey).toBeDefined();
    // Pass 2: unfiltered hash — empty filters, i.e. a pure function of the index input.
    expect(unfilteredCall[1].statusFilterKey).toBeUndefined();
    expect(unfilteredCall[1].filters).toEqual({});
    // Both passes receive the exact same index object.
    expect(filteredCall[0]).toBe(index);
    expect(unfilteredCall[0]).toBe(index);

     
    console.log(
      `[perf-showcase] 1 setIndex call on a ${ENTRY_COUNT}-entry index = ` +
        `${transformSpy.mock.calls.length} full transformStoryIndexToStoriesHash passes`
    );
  });

  it('runs 4 transforms per status event (2 rebuilds x 2 passes) over a referentially-identical index', async () => {
    // Ensure internal_index is populated (idempotent if the previous test already set it).
    await api.setIndex(index);

    const setIndexSpy = vi.spyOn(api, 'setIndex');
    transformSpy.mockClear();

    const STATUS_EVENTS = 10;
    // Each status event triggers the onAllStatusChange handler, which (on this branch) calls
    // recomputeStatusFilter -> experimental_setFilter -> setIndex, AND setIndex directly:
    // 2 rebuilds x 2 transform passes = 4 transforms per event. PR #35429 removes the handler's
    // direct setIndex, halving this to 2.
    const TRANSFORMS_PER_STATUS_EVENT = 4;

    for (let i = 0; i < STATUS_EVENTS; i += 1) {
      fullStatusStore.set([
        {
          typeId: 'perf-addon',
          storyId: `perf-component-${i}--story-0`,
          value: 'status-value:pending',
          title: 'perf status',
          description: `status update ${i}`,
        },
      ]);
      // Real timers: wait for this event's async handler chain to settle before the next event,
      // so per-event counts stay deterministic.
      await vi.waitFor(() => {
        expect(transformSpy).toHaveBeenCalledTimes(TRANSFORMS_PER_STATUS_EVENT * (i + 1));
      });
    }

    const rebuilds = setIndexSpy.mock.calls.length;
    const transforms = transformSpy.mock.calls.length;

    // 2 setIndex rebuilds per status event...
    expect(rebuilds).toBe(2 * STATUS_EVENTS);
    // ...each paying the double transform: invocation count == 2x rebuild count.
    expect(transforms).toBe(2 * rebuilds);
    expect(transforms).toBe(TRANSFORMS_PER_STATUS_EVENT * STATUS_EVENTS);

    // Every single transform pass received the referentially-identical index object — no index
    // change ever occurred; all 40 full-index passes were driven purely by status events.
    for (const call of transformSpy.mock.calls) {
      expect(call[0]).toBe(index);
    }

    // The unfiltered pass (filters: {}) is a pure function of the index: every unfiltered result
    // is deep-equal to the previous one. Recomputing it per status event is pure redundancy.
    const unfilteredResults = transformSpy.mock.calls
      .map((call, callIndex) => ({ call, callIndex }))
      .filter(({ call }) => call[1].statusFilterKey === undefined)
      .map(({ callIndex }) => transformSpy.mock.results[callIndex]);
    expect(unfilteredResults).toHaveLength(2 * STATUS_EVENTS);
    for (let i = 1; i < unfilteredResults.length; i += 1) {
      expect(unfilteredResults[i].type).toBe('return');
      expect(unfilteredResults[i].value).toEqual(unfilteredResults[i - 1].value);
    }

     
    console.log(
      `[perf-showcase] ${STATUS_EVENTS} status updates on an unchanged ${ENTRY_COUNT}-entry index = ` +
        `${rebuilds} setIndex rebuilds = ${transforms} full transform passes ` +
        `(${transforms / STATUS_EVENTS} per status event; ${unfilteredResults.length} of them ` +
        `unfiltered passes whose results are all deep-equal). PR #35429 halves this to 2 per event.`
    );
  });
});
