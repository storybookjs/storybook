import type { StoryIndex } from 'storybook/internal/types';
import {
  getToolset,
  invokeToolsetMethod,
  resolveToolsetDescription,
  type ToolsetCtx,
} from 'storybook/open-service';

import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as v from 'valibot';

import type { TestRunOutput, TestRunResult } from './definition.ts';
import { createTestToolset } from './definition.ts';
import { runStoryTests } from './run.ts';

vi.mock('./run.ts', { spy: true });
vi.mock('storybook/open-service', { spy: true });

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

function a11yCheck(storyId: string, value: 'status-value:success' | 'status-value:error') {
  return {
    storyId,
    typeId: 'storybook/a11y',
    value,
    title: 'Accessibility tests',
    description: '',
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
      files: undefined,
      changed: undefined,
      getChangedStories: expect.any(Function),
      a11y: true,
    });
  });

  it('passes files through to the run', async () => {
    await runTests({ files: ['/repo/src/Button.stories.tsx'] });

    expect(runStoryTests).toHaveBeenCalledWith(
      expect.objectContaining({ files: ['/repo/src/Button.stories.tsx'] })
    );
  });

  it('selects for changed exactly the stories that stories changed lists', async () => {
    const changed = vi.fn(async () => ({
      ok: true as const,
      data: {
        stories: [{ storyId: 'button--primary' }, { storyId: 'header--default' }],
        changedConfigFiles: ['.storybook/preview.ts'],
        unindexedStoryFiles: ['src/New.stories.tsx'],
        pendingFiles: ['src/Card.tsx'],
      },
      markdown: '',
    }));
    vi.mocked(getToolset).mockReturnValue({ methods: { changed: { handler: changed } } } as never);

    await runTests({ changed: true });
    const { getChangedStories } = vi.mocked(runStoryTests).mock.lastCall![0];

    expect(await getChangedStories!()).toEqual({
      storyIds: ['button--primary', 'header--default'],
      changedConfigFiles: ['.storybook/preview.ts'],
      pendingFiles: ['src/New.stories.tsx', 'src/Card.tsx'],
    });
    expect(getToolset).toHaveBeenCalledWith('stories');
    expect(changed).toHaveBeenCalledWith({}, ctx);
  });

  it('lets the CLI fill files from bare arguments', () => {
    expect(toolset.methods.run.fileArguments).toBe('files');
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
        a11yStatuses: [a11yCheck('button--primary', 'status-value:error')],
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
    expect(outcome.markdown).not.toContain('## Passing Stories');
    expect(outcome.markdown).toContain('## Failing Stories');
    expect(outcome.markdown).toContain('### button--primary');
    expect(outcome.markdown).toContain('The accessibility check failed');
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
      expect(resolveToolsetDescription(toolset.methods.run.description, mcpCtx)).toContain(
        'For visual/design accessibility violations (for example color contrast), ask the user before changing styles.'
      );
    });

    it('makes no accessibility promise when a11y is disabled', () => {
      const withoutA11y = createTestToolset({ channel, storyIndex, a11yEnabled: false });
      const description = resolveToolsetDescription(withoutA11y.methods.run.description, mcpCtx);

      expect(description).not.toContain('accessibility');
      expect(description).toContain('Results will include passing/failing status.');
    });

    it('sends the agent to the test-stories skill of its transport first', () => {
      expect(resolveToolsetDescription(toolset.methods.run.description, mcpCtx)).toContain(
        'First run npx storybook skills test-stories --mcp once and follow it'
      );
      expect(resolveToolsetDescription(toolset.methods.run.description, ctx)).toContain(
        'First run npx storybook skills test-stories once and follow it'
      );
      expect(
        resolveToolsetDescription(toolset.methods.run.description, { ...ctx, transport: 'sdk' })
      ).not.toContain('storybook skills');
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

- button--primary

## Result

Passed: 1 component test passed.
Accessibility: not checked.
Before you finish, run every story once: test-run without \`files\`, \`changed\` or \`stories\`.`);
    });

    it('tells the CLI agent the command that runs every story after a focused pass', async () => {
      vi.mocked(runStoryTests).mockResolvedValue(
        completed({
          storyIds: ['button--primary'],
          componentTestCount: { success: 1, error: 0 },
          componentTestStatuses: [componentTest('button--primary', 'status-value:success')],
        })
      );

      expect((await runTests()).markdown).toContain(
        'Before you finish, run every story once: `npx storybook tools test run` without arguments.'
      );
    });

    it('summarizes what the file filters and the changes selected in one line', async () => {
      vi.mocked(runStoryTests).mockResolvedValue({
        ...completed({
          storyIds: ['button--primary', 'button--secondary'],
          componentTestCount: { success: 2, error: 0 },
          componentTestStatuses: [
            componentTest('button--primary', 'status-value:success'),
            componentTest('button--secondary', 'status-value:success'),
          ],
        }),
        selection: {
          files: { filters: ['src/Button.stories.tsx', 'Header'], storyFiles: 2 },
          changed: { stories: 5, changedConfigFiles: [], pendingFiles: [] },
          storyCount: 2,
        },
      } as TestRunOutput);

      expect((await runTests()).markdown).toContain(`## Result

2 story files match \`src/Button.stories.tsx\`, \`Header\`; 5 changed stories: selected 2 stories.
Passed: 2 component tests passed.`);
    });

    it('says when change detection has not caught up with a changed file', async () => {
      vi.mocked(runStoryTests).mockResolvedValue({
        status: 'no-stories',
        notFoundMessages: [],
        selection: {
          changed: { stories: 0, changedConfigFiles: [], pendingFiles: ['src/New.stories.tsx'] },
        },
      });

      expect((await runTests()).markdown).toContain(
        'Change detection has not caught up with these changed files yet, so their stories may be missing: `src/New.stories.tsx`. Run this again in a moment.'
      );
    });

    it('says when a file in the config directory changed, as stories changed does', async () => {
      vi.mocked(runStoryTests).mockResolvedValue({
        ...completed({
          storyIds: ['button--primary'],
          componentTestCount: { success: 1, error: 0 },
          componentTestStatuses: [componentTest('button--primary', 'status-value:success')],
        }),
        selection: {
          changed: { stories: 1, changedConfigFiles: ['.storybook/preview.ts'], pendingFiles: [] },
          storyCount: 1,
        },
      } as TestRunOutput);

      expect((await runTests()).markdown).toContain(`## Result

1 changed story: selected 1 story.
Changed files in the Storybook config directory, which can affect every story: \`.storybook/preview.ts\`.
Passed: 1 component test passed.`);
    });

    it('fails a run that leaves a story id unmatched, after running the rest', async () => {
      vi.mocked(runStoryTests).mockResolvedValue({
        ...completed({
          storyIds: ['button--primary'],
          componentTestCount: { success: 1, error: 0 },
          componentTestStatuses: [componentTest('button--primary', 'status-value:success')],
        }),
        selection: { storyCount: 1 },
        notFound: ['No story found for story ID "missing--story"'],
      } as TestRunOutput);

      const outcome = await runTests();

      expect(outcome.ok).toBe(false);
      expect(outcome.markdown).toContain(`## Result

No story found for story ID "missing--story"
Failed: 1 argument not used; 1 component test passed.
Accessibility: not checked.
Fix or leave out the arguments listed above, then run again.`);
      expect(outcome.markdown).not.toContain('Before you finish');
    });

    it('says why selected stories did not run only where the runner knows, and says so plainly for the rest', async () => {
      const statuses = [
        componentTest('button--primary', 'status-value:success'),
        {
          ...componentTest('button--skipped', 'status-value:success'),
          value: 'status-value:unknown',
        },
      ];
      const selection = { files: { filters: ['Button'], storyFiles: 1 }, storyCount: 3 };
      const storyIds = ['button--primary', 'button--secondary', 'button--skipped'];
      const excludedStoryIds = { byTags: ['button--skipped'], notInProject: [] };
      vi.mocked(runStoryTests).mockResolvedValue({
        ...completed({
          storyIds,
          excludedStoryIds,
          componentTestCount: { success: 1, error: 0 },
          componentTestStatuses: statuses,
        }),
        selection,
      } as TestRunOutput);

      const outcome = await runTests();

      expect(outcome.ok).toBe(true);
      expect(outcome.markdown).toContain(
        `1 story file matches \`Button\`: selected 3 stories; only 1 ran: 1 is excluded from tests by tags; 1 did not run, and Storybook cannot tell why: \`button--secondary\`.
Passed: 1 component test passed.
Accessibility: not checked.
Storybook could not run the stories listed above as not run. Do not change their tags or test settings to make that go away: tell the user which stories did not run.`
      );

      vi.mocked(runStoryTests).mockResolvedValue({
        ...completed({
          storyIds,
          excludedStoryIds,
          componentTestCount: { success: 1, error: 0 },
          componentTestStatuses: statuses,
          unhandledErrors: [{ name: 'SyntaxError', message: 'Unexpected token' }],
        }),
        selection,
      } as TestRunOutput);

      expect((await runTests()).markdown).toContain(
        '1 story file matches `Button`: selected 3 stories; only 1 ran: 1 is excluded from tests by tags; 1 did not run, and Storybook cannot tell why (see the unhandled errors): `button--secondary`.'
      );
    });

    it('passes a focused run in which tags kept every selected story out, as Vitest does with skipped tests', async () => {
      vi.mocked(runStoryTests).mockResolvedValue({
        ...completed({
          storyIds: ['button--primary', 'button--secondary'],
          excludedStoryIds: { byTags: ['button--primary'], notInProject: ['button--secondary'] },
        }),
        selection: { files: { filters: ['Button'], storyFiles: 1 }, storyCount: 2 },
      } as TestRunOutput);

      const outcome = await runTests();

      expect(outcome.ok).toBe(true);
      expect(outcome.markdown).toBe(`## Result

1 story file matches \`Button\`: selected 2 stories; none ran: 1 is excluded from tests by tags; 1 is in story files the Storybook Vitest project does not include.
No component tests ran.
Accessibility: not checked.`);
    });

    // SB-2557: the run used to blame tags here.
    it('says plainly that selected stories did not run for no known reason', async () => {
      vi.mocked(runStoryTests).mockResolvedValue({
        ...completed({
          storyIds: ['button--primary', 'button--secondary'],
          excludedStoryIds: { byTags: [], notInProject: [] },
        }),
        selection: { storyCount: 2 },
      } as TestRunOutput);

      const outcome = await runTests();

      expect(outcome.markdown).toBe(`## Result

Selected 2 stories; none ran: 2 did not run, and Storybook cannot tell why: \`button--primary\`, \`button--secondary\`.
No component tests ran.
Accessibility: not checked.
Storybook could not run the stories listed above as not run. Do not change their tags or test settings to make that go away: tell the user which stories did not run.`);
    });

    it('fails when no story file matches, pointing a component file to changed', async () => {
      vi.mocked(runStoryTests).mockResolvedValue({
        status: 'no-stories',
        notFoundMessages: ['No story files found for `src/Button.tsx`.'],
        selection: { files: { filters: ['src/Button.tsx'], storyFiles: 0 } },
      });

      const outcome = await runTests();

      expect(outcome.ok).toBe(false);
      expect(outcome.markdown).toBe(`No stories found matching the provided input.

No story files found for \`src/Button.tsx\`.
File arguments select story files by path, as Vitest filters select test files. To test the stories that depend on a changed file, use \`--changed\`.`);
    });

    it('passes when no story changed, with what to try next', async () => {
      vi.mocked(runStoryTests).mockResolvedValue({
        status: 'no-stories',
        notFoundMessages: [],
        selection: {
          changed: { stories: 0, changedConfigFiles: ['.storybook/main.ts'], pendingFiles: [] },
        },
      });

      const outcome = await runTests();
      const mcpOutcome = await runForMcp();

      expect(outcome.ok).toBe(true);
      expect(outcome.markdown).toBe(`No stories changed, so no tests ran.
Changed files in the Storybook config directory, which can affect every story: \`.storybook/main.ts\`.
To test more, pass story files. Before you finish, run every story once: \`npx storybook tools test run\` without arguments.`);
      expect(mcpOutcome.markdown).toContain(
        'Before you finish, run every story once: test-run without `files`, `changed` or `stories`.'
      );
    });

    it('passes when no story file matches the filters under changed, as Vitest does', async () => {
      vi.mocked(runStoryTests).mockResolvedValue({
        status: 'no-stories',
        notFoundMessages: [],
        selection: { files: { filters: ['src/Button.tsx'], storyFiles: 0 } },
      });

      const outcome = await runTests();

      expect(outcome.ok).toBe(true);
      expect(outcome.markdown).toContain(
        'No story files found for `src/Button.tsx`, so no tests ran.'
      );
      expect(outcome.markdown).toContain(
        'Before you finish, run every story once: `npx storybook tools test run` without arguments.'
      );
    });

    it('says when none of the stories the other forms selected changed', async () => {
      vi.mocked(runStoryTests).mockResolvedValue({
        status: 'no-stories',
        notFoundMessages: [],
        selection: {
          files: { filters: ['Header'], storyFiles: 1 },
          changed: { stories: 3, changedConfigFiles: [], pendingFiles: [] },
        },
      });

      expect((await runTests()).markdown).toContain(
        'None of the selected stories changed, so no tests ran.'
      );
    });

    it('says why accessibility was not checked when addon-a11y is not enabled', async () => {
      vi.mocked(runStoryTests).mockResolvedValue(
        completed({
          storyIds: ['button--primary'],
          totalTestCount: 1,
          componentTestCount: { success: 1, error: 0 },
          componentTestStatuses: [componentTest('button--primary', 'status-value:success')],
        })
      );
      toolset = createTestToolset({ channel, storyIndex, a11yEnabled: false });

      expect((await runForMcp()).markdown).toBe(`## Passing Stories

- button--primary

## Result

Passed: 1 component test passed.
Accessibility: not checked (addon-a11y is not enabled).
Before you finish, run every story once: test-run without \`files\`, \`changed\` or \`stories\`.`);
    });

    it('says the accessibility check found nothing rather than staying silent', async () => {
      vi.mocked(runStoryTests).mockResolvedValue(
        completed({
          componentTestCount: { success: 2, error: 0 },
          a11yCount: { success: 2, warning: 0, error: 0 },
          componentTestStatuses: [
            componentTest('button--primary', 'status-value:success'),
            componentTest('button--secondary', 'status-value:success'),
          ],
        })
      );

      expect((await runForMcp()).markdown).toBe(`## Passing Stories

- button--primary
- button--secondary

## Result

Passed: 2 component tests passed.
Accessibility: 2 stories checked, no violations.`);
    });

    it('lists a story whose accessibility check fails the run as failing, not passing', async () => {
      vi.mocked(runStoryTests).mockResolvedValue(
        completed({
          componentTestCount: { success: 2, error: 0 },
          a11yCount: { success: 1, warning: 0, error: 1 },
          componentTestStatuses: [
            componentTest('button--primary', 'status-value:success'),
            componentTest('button--secondary', 'status-value:success'),
          ],
          a11yStatuses: [
            a11yCheck('button--primary', 'status-value:error'),
            a11yCheck('button--secondary', 'status-value:success'),
          ],
          a11yReports: {
            'button--primary': [
              {
                violations: [
                  {
                    id: 'color-contrast',
                    description: 'Color contrast ratio is insufficient',
                    nodes: [{ html: '<button>Click me</button>', impact: 'serious' }],
                  },
                ],
              },
            ],
          },
        })
      );

      const outcome = await runForMcp();

      expect(outcome.ok).toBe(false);
      expect(outcome.markdown).toBe(`## Passing Stories

- button--secondary

## Failing Stories

### button--primary

The accessibility check failed; see Accessibility Violations below.

## Accessibility Violations

### button--primary - color-contrast

Color contrast ratio is insufficient

#### Affected Elements
- **Impact**: serious
  **Element**: <button>Click me</button>

## Result

Failed: 1 accessibility check failed.
Accessibility: 2 stories checked; 1 without violations; 1 failing the run.
Fix what fails and run again, changing only what each failure needs. Do not finish with failing tests.
Accessibility violations: fix only what your change caused, and report the rest. For visual ones such as color contrast, ask before changing the design.`);
    });

    it('lists failing stories with their descriptions', async () => {
      vi.mocked(runStoryTests).mockResolvedValue(
        completed({
          componentTestCount: { success: 1, error: 1 },
          a11yCount: { success: 1, warning: 0, error: 0 },
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

      const outcome = await runForMcp();

      expect(outcome.ok).toBe(false);
      expect(outcome.markdown).toBe(`## Passing Stories

- button--primary

## Failing Stories

### button--secondary

Expected button text to be "Secondary"

## Result

Failed: 1 component test failed.
Accessibility: 1 story checked, no violations. Stories with a failing component test get no accessibility result.
Fix what fails and run again, changing only what each failure needs. Do not finish with failing tests.`);
    });

    it('reports accessibility violations with inspect links built from the origin', async () => {
      vi.mocked(runStoryTests).mockResolvedValue(
        completed({
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
  **Inspect**: http://localhost:6006/inspect/button--primary?inspectPath=button.0

## Result

Passed: 1 component test passed.
Accessibility: 1 story checked; 1 with violations reported as warnings, which do not fail the run.
Accessibility violations: fix only what your change caused, and report the rest. For visual ones such as color contrast, ask before changing the design.`);
    });

    it('omits accessibility violations when the run disabled a11y', async () => {
      vi.mocked(runStoryTests).mockResolvedValue(
        completed({
          componentTestCount: { success: 1, error: 0 },
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

- button--primary

## Result

Passed: 1 component test passed.
Accessibility: skipped (a11y: false).`);
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

      const outcome = await runForMcp();

      expect(outcome.ok).toBe(false);
      expect(outcome.markdown).toBe(`## Unhandled Errors

### ReferenceError

**Error message**: foo is not defined
**Path**: /src/Button.stories.tsx
**Test name**: Button > Primary
**Stack trace**:
ReferenceError: foo is not defined
    at Button.tsx:10:5

## Result

Failed: 1 unhandled error.
Accessibility: not checked.
Fix what fails and run again, changing only what each failure needs. Do not finish with failing tests.`);
    });

    it('passes a run whose accessibility violations are only warnings, and says so', async () => {
      vi.mocked(runStoryTests).mockResolvedValue(
        completed({
          componentTestCount: { success: 1, error: 0 },
          a11yCount: { success: 0, warning: 1, error: 0 },
          componentTestStatuses: [componentTest('button--primary', 'status-value:success')],
        })
      );

      const outcome = await runForMcp();

      expect(outcome.ok).toBe(true);
      expect(outcome.markdown).toContain(`## Result

Passed: 1 component test passed.
Accessibility: 1 story checked; 1 with violations reported as warnings, which do not fail the run.`);
    });

    it('does not call a run without component tests a pass', async () => {
      vi.mocked(runStoryTests).mockResolvedValue(completed());

      expect((await runForMcp()).markdown).toBe(`## Result

No component tests ran.
Accessibility: not checked.`);
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

      expect(outcome.ok).toBe(false);
      expect(outcome.markdown).toBe(`No stories found matching the provided input.

No story found for story ID "missing--story"
No story found for story ID "gone--story"`);
    });

    it('says an empty story list selected nothing, without failing', async () => {
      vi.mocked(runStoryTests).mockResolvedValue({ status: 'no-stories', notFoundMessages: [] });

      const outcome = await runForMcp({ stories: [] });

      expect(outcome.ok).toBe(true);
      expect(outcome.markdown).toBe(
        'No stories were given, so no tests ran. Pass files or story IDs, or neither to run every story test.'
      );
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
          inputFileCount: 0,
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
          inputFileCount: 0,
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
