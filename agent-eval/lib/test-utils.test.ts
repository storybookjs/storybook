import { execFile } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('node:child_process', { spy: true });
vi.mock('node:fs', { spy: true });

import {
  expectDevServerLeftRunning,
  findDevServerKillCommands,
  parseWorkflowToolResults,
} from './test-utils.ts';

describe('parseWorkflowToolResults', () => {
  function claudeToolUseLine(id: string, name: string, input: Record<string, unknown>): string {
    return JSON.stringify({
      type: 'assistant',
      message: { content: [{ type: 'tool_use', id, name, input }] },
    });
  }

  function claudeToolResultLine(toolUseId: string, content: unknown, isError = false): string {
    return JSON.stringify({
      type: 'user',
      message: {
        content: [{ type: 'tool_result', tool_use_id: toolUseId, content, is_error: isError }],
      },
    });
  }

  test('pairs Claude MCP tool_use and tool_result blocks by id', () => {
    const transcript = [
      claudeToolUseLine('toolu_1', 'mcp__storybook-dev-mcp__test-run', {}),
      claudeToolUseLine('toolu_2', 'mcp__storybook-dev-mcp__stories-preview', {}),
      claudeToolResultLine('toolu_2', [{ type: 'text', text: 'http://localhost:6006' }]),
      claudeToolResultLine('toolu_1', [
        { type: 'text', text: '## Passing Stories\n\n- example-button--primary' },
      ]),
    ].join('\n');

    const results = parseWorkflowToolResults(transcript, 'test-run');

    expect(results).toHaveLength(1);
    expect(results[0]?.output).toContain('## Passing Stories');
    expect(results[0]?.isError).toBe(false);
  });

  test('extracts Claude plugin-path results from storybook tools shell invocations', () => {
    const transcript = [
      claudeToolUseLine('toolu_1', 'Bash', {
        command: 'npx storybook tools --port 6006 test run',
      }),
      claudeToolResultLine('toolu_1', '## Failing Stories\n\n### example-button--primary'),
    ].join('\n');

    const results = parseWorkflowToolResults(transcript, 'test-run');

    expect(results).toHaveLength(1);
    expect(results[0]?.output).toContain('## Failing Stories');
  });

  test('marks errored Claude tool results', () => {
    const transcript = [
      claudeToolUseLine('toolu_1', 'mcp__storybook-dev-mcp__test-run', {}),
      claudeToolResultLine('toolu_1', 'Test run was cancelled', true),
    ].join('\n');

    const results = parseWorkflowToolResults(transcript, 'test-run');

    expect(results).toHaveLength(1);
    expect(results[0]?.isError).toBe(true);
  });

  test('extracts completed Codex MCP tool call results', () => {
    const transcript = [
      JSON.stringify({
        type: 'item.started',
        item: {
          type: 'mcp_tool_call',
          tool: 'test-run',
          result: null,
          status: 'in_progress',
        },
      }),
      JSON.stringify({
        type: 'item.completed',
        item: {
          type: 'mcp_tool_call',
          tool: 'test-run',
          status: 'completed',
          error: null,
          result: { content: [{ type: 'text', text: '## Passing Stories\n\n- a--b' }] },
        },
      }),
    ].join('\n');

    const results = parseWorkflowToolResults(transcript, 'test-run');

    expect(results).toHaveLength(1);
    expect(results[0]?.output).toContain('## Passing Stories');
    expect(results[0]?.isError).toBe(false);
  });

  test('extracts Codex plugin-path results from command_execution items', () => {
    const transcript = [
      JSON.stringify({
        type: 'item.completed',
        item: {
          type: 'command_execution',
          command: "/bin/bash -lc 'npx storybook tools --port 6006 test run'",
          aggregated_output: '## Passing Stories\n\n- a--b\n\n## Failing Stories\n\n### a--c',
          exit_code: 0,
          status: 'completed',
        },
      }),
    ].join('\n');

    const results = parseWorkflowToolResults(transcript, 'test-run');

    expect(results).toHaveLength(1);
    expect(results[0]?.output).toContain('## Failing Stories');
  });

  test('ignores unrelated tools and unparseable lines', () => {
    const transcript = [
      'not json',
      claudeToolUseLine('toolu_1', 'Bash', { command: 'npm run lint' }),
      claudeToolResultLine('toolu_1', 'lint ok'),
    ].join('\n');

    expect(parseWorkflowToolResults(transcript, 'test-run')).toHaveLength(0);
  });

  function codexTestRunLine(
    aggregatedOutput: string,
    command = 'npx storybook tools test run --input \'{"stories":[{"storyId":"reviews-reviewcard--default"}]}\' --json'
  ): string {
    return JSON.stringify({
      type: 'item.completed',
      item: {
        type: 'command_execution',
        command,
        aggregated_output: aggregatedOutput,
        exit_code: 0,
        status: 'completed',
      },
    });
  }

  function codexTestRunJsonLine(output: unknown): string {
    return codexTestRunLine(`${JSON.stringify(output, null, 2)}\n`);
  }

  function status(storyId: string, value: string, typeId = 'storybook/component-test') {
    return { storyId, typeId, value, title: '', description: '', sidebarContextMenu: false };
  }

  test('renders --json test-run output as the markdown report', () => {
    // Shape observed in codex-plugin-gpt-6-sol-medium 803 (2026-09-24).
    const transcript = codexTestRunJsonLine({
      status: 'completed',
      a11y: true,
      result: {
        config: { coverage: false, a11y: true },
        componentTestStatuses: [
          status('reviews-reviewcard--default', 'status-value:success'),
          status('reviews-reviewcard--with-report-action', 'status-value:success'),
        ],
        a11yStatuses: [
          status('reviews-reviewcard--default', 'status-value:success', 'storybook/a11y'),
        ],
        a11yReports: {
          'reviews-reviewcard--default': [
            {
              violations: [],
              passes: [{ id: 'button-name', description: 'Buttons have discernible text' }],
              inapplicable: [{ id: 'color-contrast' }],
            },
          ],
        },
        unhandledErrors: [],
      },
    });

    const results = parseWorkflowToolResults(transcript, 'test-run');

    expect(results).toHaveLength(1);
    expect(results[0]?.output).toBe(
      '## Passing Stories\n\n- reviews-reviewcard--default\n- reviews-reviewcard--with-report-action'
    );
  });

  test('renders failing stories, a11y violations, and unhandled errors from --json output', () => {
    const transcript = codexTestRunJsonLine({
      status: 'completed',
      a11y: true,
      result: {
        config: { coverage: false, a11y: true },
        componentTestStatuses: [
          status('a--b', 'status-value:success'),
          { ...status('a--c', 'status-value:error'), description: 'expected 1 to be 2' },
        ],
        a11yStatuses: [],
        a11yReports: {
          'a--b': [
            {
              violations: [
                {
                  id: 'button-name',
                  description: 'Buttons must have discernible text',
                  nodes: [{ impact: 'critical', html: '<button></button>' }],
                },
              ],
              passes: [],
            },
          ],
          'a--c': [{ error: { message: 'axe crashed' } }],
        },
        unhandledErrors: [{ name: 'TypeError', message: 'x is not a function' }],
      },
    });

    expect(parseWorkflowToolResults(transcript, 'test-run')[0]?.output).toBe(
      [
        '## Passing Stories\n\n- a--b',
        '## Failing Stories\n\n- a--c',
        '## Accessibility Violations\n\n- a--b - button-name',
        '## Unhandled Errors\n\n- TypeError',
      ].join('\n\n')
    );
  });

  test('omits accessibility violations when the run had a11y off', () => {
    const transcript = codexTestRunJsonLine({
      status: 'completed',
      a11y: false,
      result: {
        config: { coverage: false, a11y: true },
        componentTestStatuses: [status('a--b', 'status-value:success')],
        a11yStatuses: [],
        a11yReports: {
          'a--b': [{ violations: [{ id: 'button-name', description: 'x', nodes: [] }] }],
        },
        unhandledErrors: [],
      },
    });

    expect(parseWorkflowToolResults(transcript, 'test-run')[0]?.output).toBe(
      '## Passing Stories\n\n- a--b'
    );
  });

  test('renders --json output surrounded by diverted log lines', () => {
    const json = JSON.stringify(
      {
        status: 'completed',
        a11y: true,
        result: {
          config: { coverage: false, a11y: true },
          componentTestStatuses: [status('a--b', 'status-value:success')],
          a11yStatuses: [],
          a11yReports: {},
          unhandledErrors: [],
        },
      },
      null,
      2
    );
    const transcript = codexTestRunLine(
      `npm warn exec The following package was not found and will be installed: storybook@10.3.0\n${json}\nOutput written to /tmp/run.json\n`,
      'npx storybook tools test run --stories \'[{"storyId":"a--b"}]\' --json 2>&1'
    );

    expect(parseWorkflowToolResults(transcript, 'test-run')[0]?.output).toBe(
      '## Passing Stories\n\n- a--b'
    );
  });

  test('renders a --json no-stories outcome as the markdown report marker', () => {
    const transcript = codexTestRunJsonLine({
      status: 'no-stories',
      notFoundMessages: ['No story with id a--b'],
    });

    expect(parseWorkflowToolResults(transcript, 'test-run')[0]?.output).toBe(
      'No stories found matching the provided input.'
    );
  });

  test('leaves markdown and unrecognized JSON output untouched', () => {
    const markdown = codexTestRunLine(
      '## Passing Stories\n\n- a--b',
      'npx storybook tools test run --stories \'[{"storyId":"a--b"}]\''
    );
    const unrelatedJson = codexTestRunJsonLine({ reviewUrl: 'http://localhost:6006' });

    expect(parseWorkflowToolResults(markdown, 'test-run')[0]?.output).toBe(
      '## Passing Stories\n\n- a--b'
    );
    expect(parseWorkflowToolResults(unrelatedJson, 'test-run')[0]?.output).toContain('reviewUrl');
  });
});

describe('expectStoryTestsRanAndPassed', () => {
  // Verbatim from cc-plugin-opus-5.5-medium 808 (2026-10-04): the agent's own
  // output of this run is grep lines plus the last 40 lines of the JSON.
  const tailCutTestRun =
    'grep -n "olor" src/components/StatusPill.tsx src/components/Badge.tsx; npx storybook tools test run --json 2>&1 | tail -40';

  function testRunDocument(
    statuses: Record<string, string>,
    a11yReports: Record<string, { violations: { id: string }[] }[]> = {}
  ): string {
    const componentTestStatuses = Object.entries(statuses).map(([storyId, value]) => ({
      storyId,
      value,
      typeId: 'storybook/component-test',
      title: '',
      description: '',
    }));
    const result = { componentTestStatuses, a11yReports, unhandledErrors: [] };
    return `${JSON.stringify({ status: 'completed', a11y: true, result }, null, 2)}\n`;
  }

  function givenRun(options: {
    commands: string[];
    stdout: string;
    transcript?: string;
    exitCode?: number;
  }) {
    vi.mocked(existsSync).mockReturnValue(false);
    vi.mocked(readFileSync).mockImplementation(((path: unknown) => {
      if (String(path) === '__agent_eval__/transcript.txt') {
        return options.transcript ?? '';
      }
      if (String(path) === '__agent_eval__/agent.json') {
        return JSON.stringify({ agent: 'claude-code', integration: 'plugin' });
      }
      if (String(path) === '__agent_eval__/results.json') {
        return JSON.stringify({
          o11y: { shellCommands: options.commands.map((command) => ({ command })) },
        });
      }
      throw new Error(`Unexpected readFileSync path: ${String(path)}`);
    }) as typeof readFileSync);
    vi.mocked(execFile).mockImplementation(((
      _file: string,
      _args: string[],
      _options: unknown,
      callback: (error: Error | null, stdout: string, stderr: string) => void
    ) => {
      const error = options.exitCode
        ? Object.assign(new Error('Command failed'), { code: options.exitCode })
        : null;
      callback(error, options.stdout, 'npm warn exec storybook');
    }) as unknown as typeof execFile);
  }

  // test-utils caches the parsed transcript and the sandbox run per module.
  async function loadTestUtils() {
    vi.resetModules();
    return import('./test-utils.ts');
  }

  afterEach(() => {
    vi.mocked(readFileSync).mockRestore();
    vi.mocked(existsSync).mockRestore();
    vi.mocked(writeFileSync).mockRestore();
    vi.mocked(execFile).mockRestore();
  });

  test('names the Codex settings that Codex ignored when the agent never ran the tests', async () => {
    const ignored =
      'Codex is ignoring 1 unrecognized configuration setting: model_instructions_file is ignored.';
    givenRun({
      commands: [],
      stdout: '',
      transcript: `${JSON.stringify({ type: 'item.completed', item: { type: 'error', message: ignored } })}\n`,
    });
    const { expectStoryTestsRanAndPassed } = await loadTestUtils();

    await expect(expectStoryTestsRanAndPassed()).rejects.toThrow(
      `Expected test-run to be called. Codex reported: ${ignored}`
    );
  });

  test('judges the tests by a run in the sandbox, not by the tail-cut transcript output', async () => {
    givenRun({
      commands: [tailCutTestRun],
      stdout: testRunDocument({
        'example-badge--accent': 'status-value:success',
        'example-statuspill--active': 'status-value:success',
      }),
    });
    const { expectStoryTestsRanAndPassed } = await loadTestUtils();

    await expectStoryTestsRanAndPassed({ covering: ['badge', 'statuspill'] });

    expect(execFile).toHaveBeenCalledWith(
      'npx',
      ['storybook', 'tools', '--no-attach', 'test', 'run', '--json'],
      expect.objectContaining({ cwd: '.' }),
      expect.any(Function)
    );
  });

  test('points vitest.config.ts back at the Storybook config for the run, then restores it', async () => {
    const evalConfig = "export default defineConfig({ test: { include: ['EVAL.ts'] } });";
    givenRun({
      commands: [tailCutTestRun],
      stdout: testRunDocument({ 'example-badge--accent': 'status-value:success' }),
    });
    const readRun = vi.mocked(readFileSync).getMockImplementation()!;
    vi.mocked(readFileSync).mockImplementation(((path: unknown, ...rest: unknown[]) =>
      String(path) === 'vitest.config.ts'
        ? evalConfig
        : (readRun as (...args: unknown[]) => unknown)(path, ...rest)) as typeof readFileSync);
    vi.mocked(existsSync).mockImplementation(
      (path) => path === 'vitest.storybook.config.ts' || path === 'vitest.config.ts'
    );
    const writes: string[] = [];
    vi.mocked(writeFileSync).mockImplementation((_path, content) => {
      writes.push(`${String(_path)}: ${String(content)}`);
    });
    const { runStoryTestsInSandbox } = await loadTestUtils();

    await runStoryTestsInSandbox();

    expect(writes).toEqual([
      "vitest.config.ts: export { default } from './vitest.storybook.config.ts';\n",
      `vitest.config.ts: ${evalConfig}`,
    ]);
    expect(vi.mocked(writeFileSync).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(execFile).mock.invocationCallOrder[0]!
    );
  });

  test('runs the sandbox tests once per project directory', async () => {
    givenRun({
      commands: [tailCutTestRun],
      stdout: testRunDocument({ 'example-callout--default': 'status-value:success' }),
    });
    const { runStoryTestsInSandbox } = await loadTestUtils();

    await runStoryTestsInSandbox('packages/ui');
    await runStoryTestsInSandbox('packages/ui');

    expect(execFile).toHaveBeenCalledTimes(1);
    expect(execFile).toHaveBeenCalledWith(
      'npx',
      expect.any(Array),
      expect.objectContaining({ cwd: 'packages/ui' }),
      expect.any(Function)
    );
  });

  test("fails when the agent's own last run was red, even if the sandbox run passes", async () => {
    const lastRun = [
      {
        type: 'assistant',
        message: {
          content: [
            {
              type: 'tool_use',
              id: 'toolu_1',
              name: 'Bash',
              input: { command: 'npx storybook tools test run' },
            },
          ],
        },
      },
      {
        type: 'user',
        message: {
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'toolu_1',
              content: '## Failing Stories\n\n### example-button--primary',
            },
          ],
        },
      },
    ];
    givenRun({
      commands: ['npx storybook tools test run'],
      stdout: testRunDocument({ 'example-button--primary': 'status-value:success' }),
      transcript: lastRun.map((event) => JSON.stringify(event)).join('\n'),
    });
    const { expectStoryTestsRanAndPassed } = await loadTestUtils();

    await expect(expectStoryTestsRanAndPassed()).rejects.toThrow(/agent's last test run/);
  });

  test('fails when the sandbox run reports a failing story', async () => {
    givenRun({
      commands: [tailCutTestRun],
      stdout: testRunDocument({
        'example-badge--accent': 'status-value:success',
        'example-statuspill--active': 'status-value:error',
      }),
      exitCode: 1,
    });
    const { expectStoryTestsRanAndPassed } = await loadTestUtils();

    await expect(expectStoryTestsRanAndPassed()).rejects.toThrow(/must not report failing stories/);
  });

  test('matches covering only against the passing story ids', async () => {
    givenRun({
      commands: [tailCutTestRun],
      stdout: testRunDocument(
        { 'example-input--default': 'status-value:success' },
        { 'example-input--default': [{ violations: [{ id: 'button-name' }] }] }
      ),
    });
    const { expectStoryTestsRanAndPassed } = await loadTestUtils();

    await expect(expectStoryTestsRanAndPassed({ covering: ['button'] })).rejects.toThrow(
      /must cover the changed component/
    );
  });

  test('fails when the sandbox run prints no test-run document', async () => {
    givenRun({ commands: [tailCutTestRun], stdout: 'Error: no Storybook found' });
    const { expectStoryTestsRanAndPassed } = await loadTestUtils();

    await expect(expectStoryTestsRanAndPassed()).rejects.toThrow(/must complete/);
  });

  test('fails when the agent never ran the tests, even if they pass', async () => {
    givenRun({
      commands: ['npm run typecheck'],
      stdout: testRunDocument({ 'example-badge--accent': 'status-value:success' }),
    });
    const { expectStoryTestsRanAndPassed } = await loadTestUtils();

    await expect(expectStoryTestsRanAndPassed()).rejects.toThrow(/Expected test-run to be called/);
  });
});

describe('findDevServerKillCommands', () => {
  test('flags kill commands naming storybook, a pidfile, or the default port', () => {
    expect(findDevServerKillCommands(['pkill -f storybook'])).toEqual(['pkill -f storybook']);
    expect(findDevServerKillCommands(['kill $(cat /tmp/storybook.pid)'])).toHaveLength(1);
    expect(findDevServerKillCommands(['kill $(cat /tmp/dev-server.pid)'])).toHaveLength(1);
    expect(findDevServerKillCommands(['fuser -k 6006/tcp'])).toHaveLength(1);
    expect(findDevServerKillCommands(['fuser -n tcp -k 6006'])).toHaveLength(1);
    expect(findDevServerKillCommands(['kill -9 $(lsof -ti:6006)'])).toHaveLength(1);
  });

  test('ignores unrelated kill commands and non-kill dev-server commands', () => {
    expect(findDevServerKillCommands(['pkill -f chromium', 'kill 1234'])).toEqual([]);
    expect(
      findDevServerKillCommands([
        'nohup npm run storybook >/tmp/storybook.log 2>&1 &',
        'curl http://localhost:6006',
      ])
    ).toEqual([]);
  });
});

describe('expectDevServerLeftRunning', () => {
  const agentContextPath = '__agent_eval__/agent.json';

  beforeEach(() => {
    vi.mocked(readFileSync).mockReset();
  });

  afterEach(() => {
    vi.mocked(readFileSync).mockRestore();
  });

  test('fails loud when integration is mcp', () => {
    vi.mocked(readFileSync).mockImplementation(((path: unknown) => {
      if (String(path) === agentContextPath) {
        return JSON.stringify({ agent: 'claude-code', integration: 'mcp' });
      }
      throw new Error(`Unexpected readFileSync path in fail-loud helper test: ${String(path)}`);
    }) as typeof readFileSync);

    expect(() => expectDevServerLeftRunning()).toThrow(/only for plugin.*integration=mcp/);
  });
});
