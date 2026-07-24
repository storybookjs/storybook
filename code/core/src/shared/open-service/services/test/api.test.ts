import type { StoryIndex } from 'storybook/internal/types';

import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as v from 'valibot';

import type { ApiCtx } from '../../../public-api/index.ts';
import type { TestRunOutput } from './definition.ts';
import { createTestApi } from './definition.ts';
import { runStoryTests } from './run.ts';

vi.mock('./run.ts', { spy: true });

const index = { v: 5, entries: {} } as StoryIndex;
const getIndex = vi.fn();
const storyIndex = { getIndex };
const ctx = {
  consumer: 'cli',
  origin: 'http://localhost:6006',
  getService: vi.fn() as ApiCtx['getService'],
} satisfies ApiCtx;

const completedRun: TestRunOutput = {
  status: 'completed',
  result: {
    config: { a11y: true },
    componentTestStatuses: [],
    a11yStatuses: [],
    componentTestCount: { success: 2, error: 0 },
    a11yCount: { success: 1, warning: 0, error: 0 },
    a11yReports: {},
    reports: {},
    totalTestCount: 3,
    unhandledErrors: [],
  },
};

let pendingRun: Promise<TestRunOutput> | undefined;

beforeEach(() => {
  vi.clearAllMocks();
  pendingRun = undefined;
  getIndex.mockResolvedValue(index);
  vi.mocked(runStoryTests).mockImplementation(() => pendingRun ?? Promise.resolve(completedRun));
});

describe('test API', () => {
  it('returns a useful Markdown summary by default', async () => {
    const channel = {} as never;
    const testApi = createTestApi({ channel, storyIndex });

    await expect(
      testApi.methods.run.handler(v.parse(testApi.methods.run.schema, {}), ctx)
    ).resolves.toBe(
      [
        '# Test run completed',
        '- Total tests: 3',
        '- Component tests: 2 passed, 0 failed',
        '- Accessibility tests: 1 passed, 0 warnings, 0 failed',
      ].join('\n')
    );
    expect(runStoryTests).toHaveBeenCalledWith({
      channel,
      getIndex,
      stories: undefined,
      a11y: true,
    });
  });

  it('returns the existing TestRunOutput when json is true', async () => {
    const testApi = createTestApi({ channel: {} as never, storyIndex });

    await expect(
      testApi.methods.run.handler(v.parse(testApi.methods.run.schema, { json: true }), ctx)
    ).resolves.toEqual(completedRun);
  });

  it('serializes concurrent test runs for one API registration', async () => {
    const testApi = createTestApi({ channel: {} as never, storyIndex });
    let completePendingRun!: () => void;
    pendingRun = new Promise((resolve) => {
      completePendingRun = () => resolve(completedRun);
    });

    const input = v.parse(testApi.methods.run.schema, { json: true });
    const firstRun = testApi.methods.run.handler(input, ctx);
    await vi.waitFor(() => expect(runStoryTests).toHaveBeenCalledOnce());

    const secondRun = testApi.methods.run.handler(input, ctx);
    await Promise.resolve();
    expect(runStoryTests).toHaveBeenCalledOnce();

    completePendingRun();
    await firstRun;
    await expect(secondRun).resolves.toEqual(completedRun);
    expect(runStoryTests).toHaveBeenCalledTimes(2);
  });

  it('creates a definition containing only public API fields', () => {
    const testApi = createTestApi({ channel: {} as never, storyIndex });

    expect(Object.keys(testApi)).toEqual(['id', 'description', 'methods']);
    for (const method of Object.values(testApi.methods)) {
      expect(Object.keys(method).sort()).toEqual(['description', 'handler', 'schema']);
    }
  });
});
