/**
 * PERF SHOWCASE — quadratic full-state flush payloads in addon-vitest's TestManager.
 *
 * Bottleneck: `throttledFlushTestCaseResults` (node/test-manager.ts:264-321) appends every test
 * case result to `currentRun.componentTestStatuses` / `a11yStatuses` / `reports` / `a11yReports`
 * and then calls `store.setState`. A UniversalStore leader serializes its ENTIRE state into a
 * SET_STATE channel event on every setState, so every 500ms flush re-sends all previously
 * accumulated statuses PLUS the constant `index` + `previewAnnotations` embedded in the store
 * state (types.ts:65-81). Wire bytes per flush therefore grow linearly with finished tests,
 * making cumulative IPC traffic O(n^2) in test count. On a 3,583-test project this explains the
 * measured tail deceleration (first 500 tests ~11s, last 500 ~80s): late flushes each ship close
 * to a megabyte of JSON over the channel.
 *
 * This test drives a real TestManager over a MockUniversalStore seeded with a 2,000-entry story
 * index, feeds 2,000 passing results in 40 batches of 50 (advancing fake timers 500ms per batch
 * so each batch flushes), and records `JSON.stringify(store.getState()).length` after each flush
 * window — the payload a SET_STATE event would serialize. One sample is taken per 500ms window;
 * es-toolkit's throttle also fires a leading-edge flush inside each window, so real wire traffic
 * is roughly 2x these numbers (i.e. the demonstrated totals are a LOWER bound).
 *
 * Demonstrated numbers:
 *
 * 1. Per-flush payloads grow linearly: mean of the last 10 flushes' accumulated-result bytes
 *    (payload minus the constant pre-run baseline) is >= 1.8x the mean of the first 10.
 * 2. Cumulative bytes across the 40 flushes, and the arithmetic projection to a 3,500-test run
 *    (logged in MB) — tens of megabytes for state that a delta-based protocol would ship once.
 * 3. The constant `index` + `previewAnnotations` baseline alone is >= 50% of the FIRST flush's
 *    payload — dead weight re-sent on every flush of every run.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TestResult } from 'vitest/node';

import { Tag, experimental_MockUniversalStore } from 'storybook/internal/core-server';
import type {
  Options,
  StatusStoreByTypeId,
  StoryIndex,
  TestProviderStoreById,
} from 'storybook/internal/types';

import { STATUS_TYPE_ID_A11Y, STATUS_TYPE_ID_COMPONENT_TEST, storeOptions } from '../constants.ts';
import type { StoreEvent, StoreState } from '../types.ts';
import { TestManager, type TestManagerOptions } from './test-manager.ts';

const vitest = vi.hoisted(() => ({
  projects: [{}],
  init: vi.fn(),
  close: vi.fn(),
  onCancel: vi.fn(),
  logger: {
    clearHighlightCache: vi.fn(),
  },
  provide: vi.fn(),
  runTestSpecifications: vi.fn(),
  cancelCurrentRun: vi.fn(),
  globTestSpecifications: vi.fn(),
  getModuleProjects: vi.fn(() => []),
  setGlobalTestNamePattern: vi.fn(),
  vite: {
    watcher: {
      removeAllListeners: vi.fn(),
      on: vi.fn(),
    },
    moduleGraph: {
      getModulesByFile: () => [],
      invalidateModule: vi.fn(),
    },
  },
  config: {
    coverage: { enabled: false },
  },
}));

const mockCreateVitest = vi.fn();

vi.mock('vitest/node', () => ({
  createVitest: mockCreateVitest,
}));

const INDEX_SIZE = 2000;
const BATCH_COUNT = 40;
const BATCH_SIZE = 50;
const FLUSH_INTERVAL_MS = 500;
const PROJECTED_TEST_COUNT = 3500;

const pad = (i: number) => String(i).padStart(4, '0');

const entries: Record<string, unknown> = {};
for (let i = 0; i < INDEX_SIZE; i++) {
  const id = `components-generated-component${pad(i)}--default`;
  entries[id] = {
    type: 'story',
    subtype: 'story',
    id,
    name: 'Default',
    title: `Components/Generated/Component${pad(i)}`,
    importPath: `./src/components/generated/Component${pad(i)}.stories.tsx`,
    tags: [Tag.TEST, 'dev', 'autodocs'],
  };
}
const mockIndex = { v: 5, entries } as StoryIndex;

// Typical project-level preview annotations (addons + preview file), part of the constant state
// that is re-serialized on every SET_STATE.
const mockPreviewAnnotations = Array.from(
  { length: 20 },
  (_, i) => `/project/node_modules/@storybook/addon-fixture-${pad(i)}/dist/preview.mjs`
);

const mockStore = new experimental_MockUniversalStore<StoreState, StoreEvent>(
  {
    ...storeOptions,
    initialState: {
      ...storeOptions.initialState,
      index: mockIndex,
      previewAnnotations: mockPreviewAnnotations,
    },
  },
  vi
);

const mockComponentTestStatusStore: StatusStoreByTypeId = {
  set: vi.fn(),
  getAll: vi.fn(),
  onAllStatusChange: vi.fn(),
  onSelect: vi.fn(),
  unset: vi.fn(),
  typeId: STATUS_TYPE_ID_COMPONENT_TEST,
};
const mockA11yStatusStore: StatusStoreByTypeId = {
  set: vi.fn(),
  getAll: vi.fn(),
  onAllStatusChange: vi.fn(),
  onSelect: vi.fn(),
  unset: vi.fn(),
  typeId: STATUS_TYPE_ID_A11Y,
};
const mockTestProviderStore: TestProviderStoreById = {
  getState: vi.fn(),
  setState: vi.fn(),
  settingsChanged: vi.fn(),
  onRunAll: vi.fn(),
  onClearAll: vi.fn(),
  runWithState: vi.fn((callback) => callback()),
  testProviderId: 'test-provider-id',
};

const options: TestManagerOptions = {
  store: mockStore,
  componentTestStatusStore: mockComponentTestStatusStore,
  a11yStatusStore: mockA11yStatusStore,
  testProviderStore: mockTestProviderStore,
  onError: (message, error) => {
    throw error;
  },
  onReady: vi.fn(),
  storybookOptions: {
    configDir: '.storybook',
  } as Options,
};

const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;
const toMB = (bytes: number) => (bytes / 1024 / 1024).toFixed(1);

beforeEach(() => {
  vi.clearAllMocks();
  mockStore.setState(() => ({
    ...storeOptions.initialState,
    index: mockIndex,
    previewAnnotations: mockPreviewAnnotations,
  }));
  mockCreateVitest.mockResolvedValue(vitest);
});

describe('TestManager flush payload growth (perf showcase)', () => {
  it('re-sends the full accumulated run state (plus constant index) on every throttled flush', async () => {
    const testManager = await TestManager.start(options);

    const indexOnlyBytes = JSON.stringify(mockStore.getState().index).length;
    const baselineBytes = JSON.stringify(mockStore.getState()).length;

    const passedResult = {
      state: 'passed',
      errors: [],
    } as unknown as TestResult;
    const storyIds = Object.keys(mockIndex.entries);

    const flushBytes: number[] = [];

    vi.useFakeTimers();
    try {
      let storyIdx = 0;
      for (let batch = 0; batch < BATCH_COUNT; batch++) {
        for (let i = 0; i < BATCH_SIZE; i++) {
          testManager.onTestCaseResult({
            storyId: storyIds[storyIdx],
            testResult: passedResult,
          });
          storyIdx += 1;
        }
        // Let the 500ms throttle window elapse so the batch is flushed via setState (=> SET_STATE)
        vi.advanceTimersByTime(FLUSH_INTERVAL_MS);
        flushBytes.push(JSON.stringify(mockStore.getState()).length);
      }
    } finally {
      vi.useRealTimers();
    }

    // Sanity: every result was flushed into the ever-growing currentRun arrays
    expect(mockStore.getState().currentRun.componentTestStatuses).toHaveLength(
      BATCH_COUNT * BATCH_SIZE
    );

    // (1) Per-flush payloads grow with every batch — each flush re-serializes all prior results
    for (let i = 1; i < flushBytes.length; i++) {
      expect(flushBytes[i]).toBeGreaterThan(flushBytes[i - 1]);
    }
    const accumulatedDeltas = flushBytes.map((b) => b - baselineBytes);
    const firstTenMean = mean(accumulatedDeltas.slice(0, 10));
    const lastTenMean = mean(accumulatedDeltas.slice(-10));
    const growthRatio = lastTenMean / firstTenMean;
    expect(growthRatio).toBeGreaterThanOrEqual(1.8);
    expect(growthRatio).toBeLessThan(20); // linear-in-flush-count accumulation, not noise

    // (2) Cumulative serialized bytes across the run, and projection to a 3,500-test run.
    // Lower bound: one full-state payload per 500ms window (leading-edge flushes double this).
    const cumulativeBytes = flushBytes.reduce((a, b) => a + b, 0);
    const perBatchSlope = (flushBytes[flushBytes.length - 1] - flushBytes[0]) / (BATCH_COUNT - 1);
    const projectedFlushCount = Math.ceil(PROJECTED_TEST_COUNT / BATCH_SIZE);
    const projectedBytes =
      projectedFlushCount * flushBytes[0] +
      (perBatchSlope * ((projectedFlushCount - 1) * projectedFlushCount)) / 2;
    expect(cumulativeBytes).toBeGreaterThan(15 * 1024 * 1024); // >15 MB for 2,000 passing tests
    expect(projectedBytes).toBeGreaterThan(cumulativeBytes * 1.5);

    // (3) The constant index + previewAnnotations baseline dominates even the first flush —
    // dead weight re-shipped with every 500ms flush.
    const baselineShareOfFirstFlush = baselineBytes / flushBytes[0];
    expect(baselineShareOfFirstFlush).toBeGreaterThanOrEqual(0.5);

    console.log(
      `[perf-showcase] SET_STATE payload growth over ${BATCH_COUNT} flushes ` +
        `(${BATCH_COUNT * BATCH_SIZE} tests, ${INDEX_SIZE}-entry index):\n` +
        `[perf-showcase]   index-only baseline: ${indexOnlyBytes} bytes; ` +
        `full pre-run state baseline: ${baselineBytes} bytes ` +
        `(${(baselineShareOfFirstFlush * 100).toFixed(1)}% of first flush)\n` +
        `[perf-showcase]   first flush: ${flushBytes[0]} bytes; ` +
        `last flush: ${flushBytes[flushBytes.length - 1]} bytes; ` +
        `accumulated-result growth (mean last 10 / mean first 10): ${growthRatio.toFixed(2)}x\n` +
        `[perf-showcase]   cumulative wire bytes (lower bound): ${toMB(cumulativeBytes)} MB; ` +
        `projected for a ${PROJECTED_TEST_COUNT}-test run: ${toMB(projectedBytes)} MB`
    );
  });
});
