import type { StoryIndex } from 'storybook/internal/types';

import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as v from 'valibot';

import type { TestRunOutput } from './definition.ts';
import { createTestToolset } from './definition.ts';
import { runStoryTests } from './run.ts';

vi.mock('./run.ts', { spy: true });

const index = { v: 5, entries: {} } as StoryIndex;
const getIndex = vi.fn();
const storyIndex = { getIndex };
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
  it('renders a run summary alongside the structured result', async () => {
    const channel = {} as never;
    const testToolset = createTestToolset({ channel, storyIndex });

    const outcome = await testToolset.methods.run.handler(
      v.parse(testToolset.methods.run.schema, {})
    );

    expect(outcome).toEqual({
      ok: true,
      data: completedRun,
      markdown: [
        '# Test run completed',
        '- Total tests: 3',
        '- Component tests: 2 passed, 0 failed',
        '- Accessibility tests: 1 passed, 0 warnings, 0 failed',
      ].join('\n'),
    });
    expect(runStoryTests).toHaveBeenCalledWith({
      channel,
      getIndex,
      stories: undefined,
      a11y: true,
    });
  });

  it('serializes concurrent test runs for one API registration', async () => {
    const testToolset = createTestToolset({ channel: {} as never, storyIndex });
    let completePendingRun!: () => void;
    pendingRun = new Promise((resolve) => {
      completePendingRun = () => resolve(completedRun);
    });

    const input = v.parse(testToolset.methods.run.schema, {});
    const firstRun = testToolset.methods.run.handler(input);
    await vi.waitFor(() => expect(runStoryTests).toHaveBeenCalledOnce());

    const secondRun = testToolset.methods.run.handler(input);
    await Promise.resolve();
    expect(runStoryTests).toHaveBeenCalledOnce();

    completePendingRun();
    await firstRun;
    await expect(secondRun).resolves.toMatchObject({ ok: true, data: completedRun });
    expect(runStoryTests).toHaveBeenCalledTimes(2);
  });
});
