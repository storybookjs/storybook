import { readFileSync } from 'node:fs';

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('node:fs', { spy: true });

import {
  expectPreviewBrowserStarted,
  expectValidStorybookLaunchConfig,
  findDevServerKillCommands,
  isLocalDevServerUrl,
  isLocalStorybookPreviewUrl,
  parseCodexBrowserNavigations,
  parseWorkflowToolResults,
  selectFinalRunStoryTestsReport,
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

describe('selectFinalRunStoryTestsReport', () => {
  const passingReport = {
    output: '## Passing Stories\n\n- example-button--primary',
    isError: false,
  };

  test('skips trailing shell-filtered fragments and picks the last real report', () => {
    const filteredFragment = { output: 'exit-check-done', isError: false };
    const failedGrep = { output: '', isError: true };

    expect(selectFinalRunStoryTestsReport([passingReport, filteredFragment, failedGrep])).toBe(
      passingReport
    );
  });

  test('prefers a later real report over an earlier one', () => {
    const failingReport = { output: '## Failing Stories\n\n### a--c', isError: false };

    expect(selectFinalRunStoryTestsReport([passingReport, failingReport])).toBe(failingReport);
  });

  test('falls back to the raw last result when no output is recognizable', () => {
    const errorResult = { output: 'Error: dev server unreachable', isError: true };

    expect(selectFinalRunStoryTestsReport([errorResult])).toBe(errorResult);
    expect(selectFinalRunStoryTestsReport([])).toBeUndefined();
  });
});

describe('parseCodexBrowserNavigations', () => {
  const jsToolCallLine = (code: string, itemOverrides: Record<string, unknown> = {}) =>
    JSON.stringify({
      type: 'item.completed',
      item: {
        type: 'mcp_tool_call',
        server: 'node_repl',
        tool: 'js',
        status: 'completed',
        error: null,
        arguments: { code, title: 'test', timeout_ms: 30000 },
        ...itemOverrides,
      },
    });

  test('extracts goto URL literals from successful node_repl js calls', () => {
    const transcript = [
      jsToolCallLine(
        "var tab = (await browser.tabs.selected()) ?? (await browser.tabs.new());\nawait tab.goto('http://localhost:6006/?path=/review/');"
      ),
      'not json',
      jsToolCallLine('await tab.goto("http://localhost:6006/?path=/story/button--primary");'),
    ].join('\n');

    expect(parseCodexBrowserNavigations(transcript)).toEqual([
      'http://localhost:6006/?path=/review/',
      'http://localhost:6006/?path=/story/button--primary',
    ]);
  });

  test('ignores failed js calls, other servers, and code without a goto', () => {
    const transcript = [
      jsToolCallLine("await tab.goto('http://localhost:6006/');", { status: 'failed' }),
      jsToolCallLine("await tab.goto('http://localhost:6006/');", { error: 'timed out' }),
      jsToolCallLine('nodeRepl.write(await browser.documentation());'),
      jsToolCallLine("await tab.goto('http://localhost:6006/');", { server: 'other-server' }),
    ].join('\n');

    expect(parseCodexBrowserNavigations(transcript)).toEqual([]);
  });

  test('returns no navigations for an empty transcript', () => {
    expect(parseCodexBrowserNavigations('')).toEqual([]);
  });
});

describe('isLocalDevServerUrl', () => {
  test('accepts http URLs on local hosts', () => {
    expect(isLocalDevServerUrl('http://localhost:6006/?path=/story/button--primary')).toBe(true);
    expect(isLocalDevServerUrl('http://127.0.0.1:4123/iframe.html?id=button--primary')).toBe(true);
    expect(isLocalDevServerUrl('http://[::1]:6006/')).toBe(true);
  });

  test('rejects remote URLs, other protocols, and non-URLs', () => {
    expect(isLocalDevServerUrl('https://storybook.js.org')).toBe(false);
    expect(isLocalDevServerUrl('file:///tmp/index.html')).toBe(false);
    expect(isLocalDevServerUrl('about:blank')).toBe(false);
    expect(isLocalDevServerUrl('not a url')).toBe(false);
  });
});

describe('findDevServerKillCommands', () => {
  const navigated = ['http://localhost:6006/?path=/review/'];

  test('flags kill commands targeting the dev server', () => {
    expect(findDevServerKillCommands(['pkill -f storybook'], navigated)).toEqual([
      'pkill -f storybook',
    ]);
    expect(findDevServerKillCommands(['kill $(cat /tmp/storybook.pid)'], navigated)).toHaveLength(
      1
    );
    expect(findDevServerKillCommands(['fuser -k 6006/tcp'], navigated)).toHaveLength(1);
    expect(findDevServerKillCommands(['fuser -n tcp -k 6006'], navigated)).toHaveLength(1);
  });

  // Documents the heuristic's accepted blind spot: a kill routed through an
  // unrelated variable in a later command carries no self-describing token,
  // so it is NOT flagged (see the comment on findDevServerKillCommands).
  test('does not flag a variable-indirected kill in a later command', () => {
    expect(findDevServerKillCommands(['PID=$(lsof -ti:6006)', 'kill $PID'], navigated)).toEqual([]);
  });

  test('ignores unrelated kill commands and non-kill dev-server commands', () => {
    expect(findDevServerKillCommands(['pkill -f chromium'], navigated)).toEqual([]);
    expect(
      findDevServerKillCommands(
        ['nohup npm run storybook >/tmp/storybook.log 2>&1 &', 'curl http://localhost:6006'],
        navigated
      )
    ).toEqual([]);
  });
});

describe('isLocalStorybookPreviewUrl', () => {
  test('accepts local Storybook review, story, and iframe preview URLs', () => {
    expect(isLocalStorybookPreviewUrl('http://localhost:6006/?path=/review/change')).toBe(true);
    expect(isLocalStorybookPreviewUrl('http://localhost:6006/?path=/story/button--primary')).toBe(
      true
    );
    expect(isLocalStorybookPreviewUrl('http://127.0.0.1:4123/iframe.html?id=button--primary')).toBe(
      true
    );
  });

  test('rejects non-Storybook local URLs and remote Storybook URLs', () => {
    // The app's own dev server or a bare Storybook root is not the result link.
    expect(isLocalStorybookPreviewUrl('http://localhost:5173/')).toBe(false);
    expect(isLocalStorybookPreviewUrl('http://localhost:6006/')).toBe(false);
    expect(isLocalStorybookPreviewUrl('https://storybook.js.org/?path=/story/button')).toBe(false);
  });
});

describe('launch/preview helpers fail loud out of context', () => {
  const agentContextPath = '__agent_eval__/agent.json';

  beforeEach(() => {
    vi.mocked(readFileSync).mockReset();
  });

  afterEach(() => {
    vi.mocked(readFileSync).mockRestore();
  });

  function stubAgentContext(agent: string, integration: 'mcp' | 'plugin') {
    vi.mocked(readFileSync).mockImplementation(((path: unknown) => {
      if (String(path) === agentContextPath) {
        return JSON.stringify({ agent, integration, review: false });
      }
      throw new Error(`Unexpected readFileSync path in fail-loud helper test: ${String(path)}`);
    }) as typeof readFileSync);
  }

  test('expectValidStorybookLaunchConfig fails when integration is mcp', () => {
    stubAgentContext('claude-code', 'mcp');

    expect(() => expectValidStorybookLaunchConfig()).toThrow(
      /only for claude-code \+ plugin.*integration=mcp/
    );
  });

  test('expectValidStorybookLaunchConfig fails for codex plugin (not Claude preview tooling)', () => {
    stubAgentContext('codex', 'plugin');

    expect(() => expectValidStorybookLaunchConfig()).toThrow(
      /only for claude-code \+ plugin.*agent=codex/
    );
  });

  test('expectPreviewBrowserStarted fails when integration is mcp', () => {
    stubAgentContext('claude-code', 'mcp');

    expect(() => expectPreviewBrowserStarted()).toThrow(/only for plugin.*integration=mcp/);
  });
});
