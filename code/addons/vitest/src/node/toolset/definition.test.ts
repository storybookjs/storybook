import type { StoryIndex } from 'storybook/internal/types';
import type { ToolsetCtx } from 'storybook/open-service';

import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as v from 'valibot';

import type { TestRunOutput, TestRunResult } from './definition.ts';
import { createTestToolset } from './definition.ts';
import { runStoryTests } from './run.ts';

vi.mock('./run.ts', { spy: true });

const index = { v: 5, entries: {} } as StoryIndex;
const getIndex = vi.fn();
const storyIndex = { getIndex };
const telemetry = vi.fn();
const channel = {} as never;

const ctx = {
  transport: 'cli',
  origin: 'http://localhost:6006',
  getService: vi.fn() as ToolsetCtx['getService'],
  telemetry,
} satisfies ToolsetCtx;

const mcpCtx = { ...ctx, transport: 'mcp' } satisfies ToolsetCtx;

const baseResult: TestRunResult = {
  config: { coverage: false, a11y: false },
  componentTestStatuses: [],
  a11yStatuses: [],
  componentTestCount: { success: 0, error: 0 },
  a11yCount: { success: 0, warning: 0, error: 0 },
  a11yReports: {},
  reports: {},
  unhandledErrors: [],
};

function componentTest(
  storyId: string,
  value: 'status-value:success' | 'status-value:error',
  description = ''
) {
  return {
    storyId,
    typeId: 'storybook/component-test',
    value,
    title: 'Component Test',
    description,
  };
}

function completed(result: Partial<TestRunResult> = {}): TestRunOutput {
  return { status: 'completed', result: { ...baseResult, ...result } };
}

const completedRun = completed({
  componentTestCount: { success: 2, error: 0 },
  a11yCount: { success: 1, warning: 0, error: 0 },
  totalTestCount: 3,
});

let toolset: ReturnType<typeof createTestToolset>;
let pendingRun: Promise<TestRunOutput> | undefined;

beforeEach(() => {
  vi.clearAllMocks();
  pendingRun = undefined;
  getIndex.mockResolvedValue(index);
  vi.mocked(runStoryTests).mockImplementation(() => pendingRun ?? Promise.resolve(completedRun));
  toolset = createTestToolset({ channel, storyIndex, a11yEnabled: true });
});

function runTests(
  input: v.InferInput<typeof toolset.methods.run.input> = {},
  runCtx: ToolsetCtx = ctx
) {
  return toolset.methods.run.handler(v.parse(toolset.methods.run.input, input), runCtx);
}

/** Runs and renders the way the MCP adapter does: one handler call, markdown from the outcome. */
async function runForMcp(input: v.InferInput<typeof toolset.methods.run.input> = {}) {
  return runTests(input, mcpCtx);
}

describe('test API', () => {
  it('runs all stories and reports the requested a11y flag alongside the outcome', async () => {
    const outcome = await runTests();

    expect(outcome.ok).toBe(true);
    expect(outcome.data).toEqual({ ...completedRun, a11y: true });
    expect(runStoryTests).toHaveBeenCalledWith({
      channel,
      getIndex,
      stories: undefined,
      a11y: true,
    });
  });

  it('renders the same per-story report for the CLI consumer as for MCP', async () => {
    vi.mocked(runStoryTests).mockResolvedValue(
      completed({
        componentTestCount: { success: 1, error: 1 },
        a11yCount: { success: 0, warning: 0, error: 1 },
        componentTestStatuses: [
          componentTest('button--primary', 'status-value:success'),
          componentTest(
            'button--secondary',
            'status-value:error',
            'Expected button text to be "Secondary"'
          ),
        ],
        a11yReports: {
          'button--primary': [
            {
              violations: [
                {
                  id: 'color-contrast',
                  description: 'Color contrast ratio is insufficient',
                  nodes: [{ html: '<button>Click me</button>', impact: 'critical' }],
                },
              ],
            },
          ],
        },
      })
    );

    const outcome = await runTests();
    const mcpOutcome = await runForMcp();

    expect(outcome.markdown).toBe(mcpOutcome.markdown);
    expect(outcome.markdown).toContain('## Passing Stories');
    expect(outcome.markdown).toContain('- button--primary');
    expect(outcome.markdown).toContain('## Failing Stories');
    expect(outcome.markdown).toContain('### button--secondary');
    expect(outcome.markdown).toContain('Expected button text to be "Secondary"');
    expect(outcome.markdown).toContain('## Accessibility Violations');
    expect(outcome.markdown).toContain('### button--primary - color-contrast');
    expect(outcome.markdown).toContain('Color contrast ratio is insufficient');
  });

  it('serializes concurrent test runs for one API registration', async () => {
    let completePendingRun!: () => void;
    pendingRun = new Promise((resolve) => {
      completePendingRun = () => resolve(completedRun);
    });

    const firstRun = runTests();
    await vi.waitFor(() => expect(runStoryTests).toHaveBeenCalledOnce());

    const secondRun = runTests();
    await Promise.resolve();
    expect(runStoryTests).toHaveBeenCalledOnce();

    completePendingRun();
    await firstRun;
    await expect(secondRun).resolves.toMatchObject({
      ok: true,
      data: { ...completedRun, a11y: true },
    });
    expect(runStoryTests).toHaveBeenCalledTimes(2);
  });

  describe('run outcome', () => {
    it('flags a completed run with failing tests as a failure', async () => {
      vi.mocked(runStoryTests).mockResolvedValue(
        completed({
          componentTestCount: { success: 1, error: 1 },
          componentTestStatuses: [
            componentTest('button--primary', 'status-value:success'),
            componentTest('button--secondary', 'status-value:error', 'Assertion failed'),
          ],
        })
      );

      expect((await runTests()).ok).toBe(false);
    });

    it('flags a completed run with unhandled errors as a failure', async () => {
      vi.mocked(runStoryTests).mockResolvedValue(
        completed({
          componentTestCount: { success: 1, error: 0 },
          unhandledErrors: [{ name: 'ReferenceError', message: 'foo is not defined' }],
        })
      );

      expect((await runTests()).ok).toBe(false);
    });

    it('flags error-level accessibility results as a failure', async () => {
      vi.mocked(runStoryTests).mockResolvedValue(
        completed({
          componentTestCount: { success: 1, error: 0 },
          a11yCount: { success: 0, warning: 0, error: 1 },
        })
      );

      expect((await runTests()).ok).toBe(false);
    });

    it('passes a run whose accessibility results only carry warnings', async () => {
      vi.mocked(runStoryTests).mockResolvedValue(
        completed({
          componentTestCount: { success: 1, error: 0 },
          a11yCount: { success: 0, warning: 2, error: 0 },
        })
      );

      expect((await runTests()).ok).toBe(true);
    });

    it('ignores error-level accessibility results when the run disabled a11y', async () => {
      vi.mocked(runStoryTests).mockResolvedValue(
        completed({
          componentTestCount: { success: 1, error: 0 },
          a11yCount: { success: 0, warning: 0, error: 1 },
        })
      );

      expect((await runTests({ a11y: false })).ok).toBe(true);
    });
  });

  describe('description', () => {
    it('promises accessibility reports when a11y is enabled', () => {
      expect(toolset.methods.run.description).toContain(
        'For visual/design accessibility violations (for example color contrast), ask the user before changing styles.'
      );
    });

    it('makes no accessibility promise when a11y is disabled', () => {
      const withoutA11y = createTestToolset({ channel, storyIndex, a11yEnabled: false });

      expect(withoutA11y.methods.run.description).not.toContain('accessibility');
      expect(withoutA11y.methods.run.description).toContain(
        'Results will include passing/failing status.'
      );
    });
  });

  describe('MCP rendering', () => {
    it('lists passing stories', async () => {
      vi.mocked(runStoryTests).mockResolvedValue(
        completed({
          storyIds: ['button--primary'],
          totalTestCount: 1,
          componentTestCount: { success: 1, error: 0 },
          componentTestStatuses: [componentTest('button--primary', 'status-value:success')],
        })
      );

      expect((await runForMcp()).markdown).toBe(`## Passing Stories

- button--primary`);
    });

    it('lists failing stories with their descriptions', async () => {
      vi.mocked(runStoryTests).mockResolvedValue(
        completed({
          componentTestCount: { success: 1, error: 1 },
          componentTestStatuses: [
            componentTest('button--primary', 'status-value:success'),
            componentTest(
              'button--secondary',
              'status-value:error',
              'Expected button text to be "Secondary"'
            ),
          ],
        })
      );

      expect((await runForMcp()).markdown).toBe(`## Passing Stories

- button--primary

## Failing Stories

### button--secondary

Expected button text to be "Secondary"`);
    });

    it('reports accessibility violations with inspect links built from the origin', async () => {
      vi.mocked(runStoryTests).mockResolvedValue(
        completed({
          componentTestCount: { success: 1, error: 0 },
          a11yCount: { success: 0, warning: 1, error: 1 },
          componentTestStatuses: [componentTest('button--primary', 'status-value:success')],
          a11yReports: {
            'button--primary': [
              {
                violations: [
                  {
                    id: 'color-contrast',
                    description: 'Color contrast ratio is insufficient',
                    nodes: [
                      {
                        html: '<button style="color: #fff; background: #ccc;">Click me</button>',
                        impact: 'critical',
                        failureSummary: '2.5:1 (required: 4.5:1)',
                        linkPath: '/inspect/button--primary?inspectPath=button.0',
                      },
                    ],
                  },
                ],
              },
            ],
          },
        })
      );

      expect((await runForMcp()).markdown).toBe(`## Passing Stories

- button--primary

## Accessibility Violations

### button--primary - color-contrast

Color contrast ratio is insufficient

#### Affected Elements
- **Impact**: critical
  **Message**: 2.5:1 (required: 4.5:1)
  **Element**: <button style="color: #fff; background: #ccc;">Click me</button>
  **Inspect**: http://localhost:6006/inspect/button--primary?inspectPath=button.0`);
    });

    it('omits accessibility violations when the run disabled a11y', async () => {
      vi.mocked(runStoryTests).mockResolvedValue(
        completed({
          componentTestStatuses: [componentTest('button--primary', 'status-value:success')],
          a11yReports: {
            'button--primary': [
              {
                violations: [
                  {
                    id: 'color-contrast',
                    description: 'Color contrast ratio is insufficient',
                    nodes: [{ html: '<button>Click me</button>', impact: 'critical' }],
                  },
                ],
              },
            ],
          },
        })
      );

      expect((await runForMcp({ a11y: false })).markdown).toBe(`## Passing Stories

- button--primary`);
    });

    it('reports unhandled errors without claiming any story passed', async () => {
      vi.mocked(runStoryTests).mockResolvedValue(
        completed({
          unhandledErrors: [
            {
              name: 'ReferenceError',
              message: 'foo is not defined',
              stack: 'ReferenceError: foo is not defined\n    at Button.tsx:10:5',
              VITEST_TEST_PATH: '/src/Button.stories.tsx',
              VITEST_TEST_NAME: 'Button > Primary',
            },
          ],
        })
      );

      expect((await runForMcp()).markdown).toBe(`## Unhandled Errors

### ReferenceError

**Error message**: foo is not defined
**Path**: /src/Button.stories.tsx
**Test name**: Button > Primary
**Stack trace**:
ReferenceError: foo is not defined
    at Button.tsx:10:5`);
    });

    it('returns the per-selector lookup failures when nothing matched', async () => {
      vi.mocked(runStoryTests).mockResolvedValue({
        status: 'no-stories',
        notFoundMessages: [
          'No story found for story ID "missing--story"',
          'No story found for story ID "gone--story"',
        ],
      });

      const outcome = await runForMcp({
        stories: [{ storyId: 'missing--story' }, { storyId: 'gone--story' }],
      });

      expect(outcome.ok).toBe(true);
      expect(outcome.markdown).toBe(`No stories found matching the provided input.

No story found for story ID "missing--story"
No story found for story ID "gone--story"`);
    });

    it('flags a failed run as a failure while still rendering the error line', async () => {
      vi.mocked(runStoryTests).mockResolvedValue({
        status: 'error',
        error: { message: 'Vitest failed to start' },
      });

      const outcome = await runForMcp();

      expect(outcome.ok).toBe(false);
      expect(outcome.markdown).toBe('Error: Vitest failed to start');
    });

    it('flags a cancelled run as a failure while still rendering the error line', async () => {
      vi.mocked(runStoryTests).mockResolvedValue({ status: 'cancelled' });

      const outcome = await runForMcp();

      expect(outcome.ok).toBe(false);
      expect(outcome.markdown).toBe('Error: Test run was cancelled');
    });
  });

  describe('telemetry', () => {
    it('reports result counts for a completed run', async () => {
      vi.mocked(runStoryTests).mockResolvedValue(
        completed({
          storyIds: ['button--primary'],
          componentTestCount: { success: 1, error: 0 },
          a11yCount: { success: 0, warning: 1, error: 0 },
          componentTestStatuses: [componentTest('button--primary', 'status-value:success')],
          a11yReports: {
            'button--primary': [
              {
                violations: [
                  {
                    id: 'color-contrast',
                    description: 'Color contrast ratio is insufficient',
                    nodes: [{ html: '<button>Click me</button>', impact: 'critical' }],
                  },
                ],
              },
            ],
          },
        })
      );

      await runTests({ stories: [{ storyId: 'button--primary' }] });

      expect(telemetry).toHaveBeenCalledWith('tool:runStoryTests', {
        toolset: 'test',
        runA11y: true,
        inputStoryCount: 1,
        matchedStoryCount: 1,
        passingStoryCount: 1,
        failingStoryCount: 0,
        a11yViolationCount: 1,
        unhandledErrorCount: 0,
      });
    });

    it('reports zeroed counts when no story matched', async () => {
      vi.mocked(runStoryTests).mockResolvedValue({
        status: 'no-stories',
        notFoundMessages: ['No story found for story ID "missing--story"'],
      });

      await runTests({ stories: [{ storyId: 'missing--story' }], a11y: false });

      expect(telemetry).toHaveBeenCalledWith('tool:runStoryTests', {
        toolset: 'test',
        runA11y: false,
        inputStoryCount: 1,
        matchedStoryCount: 0,
        passingStoryCount: 0,
        failingStoryCount: 0,
        a11yViolationCount: 0,
        unhandledErrorCount: 0,
      });
    });

    it('stays silent for a run that never reached a verdict', async () => {
      vi.mocked(runStoryTests).mockResolvedValue({ status: 'cancelled' });

      await runTests();

      expect(telemetry).not.toHaveBeenCalled();
    });

    it.each([
      ['completed', completedRun],
      [
        'no-stories',
        {
          status: 'no-stories' as const,
          notFoundMessages: ['No story found for story ID "missing--story"'],
        },
      ],
    ])('does not fail a %s result when telemetry rejects', async (_status, result) => {
      vi.mocked(runStoryTests).mockResolvedValue(result);
      const rejectingCtx: ToolsetCtx = {
        ...ctx,
        telemetry: async () => {
          throw new Error('telemetry unavailable');
        },
      };

      const outcome = await runTests({}, rejectingCtx);

      expect(outcome.ok).toBe(true);
      expect(outcome.data.status).toBe(result.status);
    });
  });
});
