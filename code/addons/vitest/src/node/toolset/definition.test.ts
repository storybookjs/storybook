import type { StoryIndex } from 'storybook/internal/types';
import { invokeToolsetMethod, type ToolsetCtx } from 'storybook/open-service';

import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as v from 'valibot';

import type { TestRunOutput, TestRunResult } from './definition.ts';
import { createTestToolset } from './definition.ts';
import { runStoryTests } from './run.ts';

vi.mock('./run.ts', { spy: true });

const index = { v: 5, entries: {} } as StoryIndex;
const getIndex = vi.fn();
const storyIndex = { getIndex };
const channel = {} as never;

const ctx = {
  transport: 'cli',
  origin: 'http://localhost:6006',
  getService: vi.fn() as ToolsetCtx['getService'],
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
  return invokeToolsetMethod(toolset, 'run', v.parse(toolset.methods.run.input, input), runCtx);
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

    describe('Testing Library failures', () => {
      const failing = (description: string) =>
        completed({
          componentTestCount: { success: 0, error: 1 },
          componentTestStatuses: [componentTest('alert--error', 'status-value:error', description)],
        });

      const roles = `Unable to find an accessible element with the role "status"

Here are the accessible roles:

  alert:

  Name "":
  <div
    role="alert"
  />

  --------------------------------------------------`;

      const dump = `Ignored nodes: comments, script, style
<div>
  <div
    role="alert"
  >
    Locked at 10:30:00
  </div>
  <pre>
    Error: boom
    at render (/workspace/src/Alert.tsx:12:7)
&lt;/div&gt;
  </pre>
</div>`;

      it('drops the document dump of a failed query', async () => {
        vi.mocked(runStoryTests).mockResolvedValue(
          failing(`${roles}

${dump}
    at getByRole (/workspace/stories/Alert.stories.tsx:77:54)`)
        );

        expect((await runForMcp()).markdown).toBe(`## Failing Stories

### alert--error

${roles}
    at getByRole (/workspace/stories/Alert.stories.tsx:77:54)`);
      });

      it('drops every dump when a story reports several errors', async () => {
        vi.mocked(runStoryTests).mockResolvedValue(
          failing(`Unable to find role="status"

${dump}

${dump}
    at play (C:\\workspace\\stories\\Alert.stories.tsx:77:54)
${roles}

Ignored nodes: comments, script, style
<body />
Unable to find an element with the text: Unlocked.

Ignored nodes: comments, script, style
<div
  id="root"
/>
    at play (file:///C:/workspace/stories/Alert.stories.tsx:80:12)`)
        );

        expect((await runForMcp()).markdown).toBe(`## Failing Stories

### alert--error

Unable to find role="status"
    at play (C:\\workspace\\stories\\Alert.stories.tsx:77:54)
${roles}
Unable to find an element with the text: Unlocked.
    at play (file:///C:/workspace/stories/Alert.stories.tsx:80:12)`);
      });

      it('drops a dump that Testing Library truncated, before or after its closing tag', async () => {
        const truncated = `<div>\n  Loading...\n    at render (/workspace/src/Alert.tsx:12:7)\n${'  <hr />\n'.repeat(1000)}`;

        vi.mocked(runStoryTests).mockResolvedValue(
          failing(`${roles}

Ignored nodes: comments, script, style
${truncated.slice(0, 7000)}...
    at getByRole (/workspace/stories/Alert.stories.tsx:77:54)
${roles}

${dump}...
    at getByRole (/workspace/stories/Alert.stories.tsx:90:10)`)
        );

        expect((await runForMcp()).markdown).toBe(`## Failing Stories

### alert--error

${roles}
    at getByRole (/workspace/stories/Alert.stories.tsx:77:54)
${roles}
    at getByRole (/workspace/stories/Alert.stories.tsx:90:10)`);
      });

      it('keeps the matching elements when a query finds several', async () => {
        vi.mocked(runStoryTests).mockResolvedValue(
          failing(`Found multiple elements with the role "button"

Here are the matching elements:

Ignored nodes: comments, script, style
<button>
  Edit
</button>

Ignored nodes: comments, script, style
<button />

(If this is intentional, then use the \`*AllBy*\` variant of the query).

${dump}
    at getByRole (/workspace/stories/Alert.stories.tsx:77:54)`)
        );

        expect((await runForMcp()).markdown).toBe(`## Failing Stories

### alert--error

Found multiple elements with the role "button"

Here are the matching elements:

<button>
  Edit
</button>

<button />

(If this is intentional, then use the \`*AllBy*\` variant of the query).
    at getByRole (/workspace/stories/Alert.stories.tsx:77:54)`);
      });

      it('keeps the matching elements that follow one it cannot delimit', async () => {
        const description = `Found multiple elements with the role "button"

Here are the matching elements:

Ignored nodes: comments, script, style
<button>
  Edi...

Ignored nodes: comments, script, style
<button />

(If this is intentional, then use the \`*AllBy*\` variant of the query).`;

        vi.mocked(runStoryTests).mockResolvedValue(
          failing(`${description}

${dump}
    at getByRole (/workspace/stories/Alert.stories.tsx:77:54)`)
        );

        expect((await runForMcp()).markdown).toContain(`<button>
  Edi...

<button />

(If this is intentional, then use the \`*AllBy*\` variant of the query).
    at getByRole (/workspace/stories/Alert.stories.tsx:77:54)`);
      });

      it('caps a long list of accessible roles', async () => {
        const intro = `Unable to find an accessible element with the role "status"

Here are the accessible roles:
`;
        const row = `
  Name "Row":
  <tr />
`;

        vi.mocked(runStoryTests).mockResolvedValue(
          failing(`${intro}${row.repeat(200)}
${dump}
    at getByRole (/workspace/stories/Alert.stories.tsx:77:54)`)
        );

        expect((await runForMcp()).markdown).toBe(`## Failing Stories

### alert--error

${intro}${row.repeat(83).trimEnd()}

  (2808 more characters omitted)
    at getByRole (/workspace/stories/Alert.stories.tsx:77:54)`);
      });

      it('drops the dump from an unhandled error', async () => {
        vi.mocked(runStoryTests).mockResolvedValue(
          completed({
            unhandledErrors: [
              {
                name: 'TestingLibraryElementError',
                message: `${roles}\n\n${dump}`,
                stack: `Error: ${roles}\n\n${dump}\n    at play (http://localhost:63315/stories/Alert.stories.tsx:9:12)`,
                VITEST_TEST_PATH: '/workspace/stories/Alert.stories.tsx',
                VITEST_TEST_NAME: 'Error',
              },
            ],
          })
        );

        expect((await runForMcp()).markdown).toBe(`## Unhandled Errors

### TestingLibraryElementError

**Error message**: ${roles}
**Path**: /workspace/stories/Alert.stories.tsx
**Test name**: Error
**Stack trace**:
Error: ${roles}
    at play (http://localhost:63315/stories/Alert.stories.tsx:9:12)`);
      });

      it('reports an unhandled error whose message is not a string', async () => {
        vi.mocked(runStoryTests).mockResolvedValue(
          completed({ unhandledErrors: [{ name: 'Error', message: { code: 1 } }] })
        );

        expect((await runForMcp()).markdown).toContain('**Error message**: [object Object]');
      });

      it('keeps a dump it cannot delimit', async () => {
        const description = `${roles}

Ignored nodes: comments, script, style
<div>
  <div
    role="ale...
    at getByRole (/workspace/stories/Alert.stories.tsx:77:54)`;

        vi.mocked(runStoryTests).mockResolvedValue(failing(description));

        expect((await runForMcp()).markdown).toBe(`## Failing Stories

### alert--error

${description}`);
      });
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

      const outcome = await runTests({ stories: [{ storyId: 'button--primary' }] });

      expect(outcome.telemetry).toEqual({
        toolset: 'test',
        tool: 'run',
        event: 'tool:test_run',
        payload: {
          runA11y: true,
          inputStoryCount: 1,
          matchedStoryCount: 1,
          passingStoryCount: 1,
          failingStoryCount: 0,
          a11yViolationCount: 1,
          unhandledErrorCount: 0,
        },
      });
    });

    it('reports zeroed counts when no story matched', async () => {
      vi.mocked(runStoryTests).mockResolvedValue({
        status: 'no-stories',
        notFoundMessages: ['No story found for story ID "missing--story"'],
      });

      const outcome = await runTests({ stories: [{ storyId: 'missing--story' }], a11y: false });

      expect(outcome.telemetry).toEqual({
        toolset: 'test',
        tool: 'run',
        event: 'tool:test_run',
        payload: {
          runA11y: false,
          inputStoryCount: 1,
          matchedStoryCount: 0,
          passingStoryCount: 0,
          failingStoryCount: 0,
          a11yViolationCount: 0,
          unhandledErrorCount: 0,
        },
      });
    });

    it('stays silent for a run that never reached a verdict', async () => {
      vi.mocked(runStoryTests).mockResolvedValue({ status: 'cancelled' });

      const outcome = await runTests();

      expect(outcome.telemetry).toBeUndefined();
    });
  });
});
