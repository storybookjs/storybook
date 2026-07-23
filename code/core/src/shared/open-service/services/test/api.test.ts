import type { StoryIndex } from 'storybook/internal/types';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { invokeApi } from '../../../public-api/index.ts';
import type { TestRunOutput } from './definition.ts';
import { createTestApi } from './definition.ts';
import { runStoryTests } from './run.ts';

vi.mock('./run.ts', { spy: true });

const index = { v: 5, entries: {} } as StoryIndex;

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
  vi.mocked(runStoryTests).mockImplementation(() => pendingRun ?? Promise.resolve(completedRun));
});

describe('test API', () => {
  it('returns a useful Markdown summary by default', async () => {
    const channel = {} as never;
    const testApi = createTestApi({ channel, getIndex: async () => index });

    await expect(invokeApi(testApi, 'run', {})).resolves.toBe(
      [
        '# Test run completed',
        '- Total tests: 3',
        '- Component tests: 2 passed, 0 failed',
        '- Accessibility tests: 1 passed, 0 warnings, 0 failed',
      ].join('\n')
    );
    expect(runStoryTests).toHaveBeenCalledWith({
      channel,
      getIndex: expect.any(Function),
      stories: undefined,
      a11y: true,
    });
  });

  it('returns the existing TestRunOutput when json is true', async () => {
    const testApi = createTestApi({ channel: {} as never, getIndex: async () => index });

    await expect(invokeApi(testApi, 'run', { json: true })).resolves.toEqual(completedRun);
  });

  it('serializes concurrent test runs for one API registration', async () => {
    const testApi = createTestApi({ channel: {} as never, getIndex: async () => index });
    let completePendingRun!: () => void;
    pendingRun = new Promise((resolve) => {
      completePendingRun = () => resolve(completedRun);
    });

    const firstRun = invokeApi(testApi, 'run', { json: true });
    await vi.waitFor(() => expect(runStoryTests).toHaveBeenCalledOnce());

    const secondRun = invokeApi(testApi, 'run', { json: true });
    await Promise.resolve();
    expect(runStoryTests).toHaveBeenCalledOnce();

    completePendingRun();
    await firstRun;
    await expect(secondRun).resolves.toEqual(completedRun);
    expect(runStoryTests).toHaveBeenCalledTimes(2);
  });

  it('creates a definition containing only public API fields', () => {
    const testApi = createTestApi({ channel: {} as never, getIndex: async () => index });

    expect(Object.keys(testApi)).toEqual(['id', 'description', 'methods']);
    for (const method of Object.values(testApi.methods)) {
      expect(Object.keys(method).sort()).toEqual(['description', 'handler', 'schema']);
    }
  });
});
