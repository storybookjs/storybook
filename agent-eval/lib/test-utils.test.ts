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
  parseStorybookWorkflowShellCommands,
  parseWorkflowToolResults,
  selectFinalRunStoryTestsReport,
  workflowCallMatchesName,
  workflowCallIncludesStory,
  workflowCallUsesStoryId,
} from './test-utils.ts';

describe('parseStorybookWorkflowShellCommands', () => {
  test('records `skills <id>` invocations literally, with their skill id', () => {
    const calls = parseStorybookWorkflowShellCommands([
      'npx storybook skills write-story 2>&1 | grep -v "npm warn"',
      'npx storybook skills stories',
      'npx storybook skills',
    ]);

    expect(calls).toEqual([
      { name: 'skills-get', input: { id: 'write-story' }, source: 'cli' },
      { name: 'skills-get', input: { id: 'stories' }, source: 'cli' },
    ]);
  });

  test('matches write-story and --all, but not other ids, to the historic instructions name', () => {
    const calls = parseStorybookWorkflowShellCommands([
      'npx storybook skills write-story',
      'npx storybook skills --all',
      'npx storybook skills stories',
      'npx storybook skills all',
    ]);

    expect(calls.map((call) => call.input)).toEqual([
      { id: 'write-story' },
      { all: true },
      { id: 'stories' },
      { id: 'all' },
    ]);
    expect(
      calls.map((call) => workflowCallMatchesName(call, 'get-storybook-story-instructions'))
    ).toEqual([true, true, false, false]);
  });

  test('does not record skills help requests, rejected --all combinations, or quoted mentions', () => {
    const calls = parseStorybookWorkflowShellCommands([
      'npx storybook skills write-story --help',
      'npx storybook skills write-story -h && npx storybook skills --all --help',
      'npx storybook skills stories --all',
      'npx storybook skills --all stories',
      "echo 'storybook skills write-story'",
    ]);

    expect(calls).toHaveLength(0);
  });

  test('preserves repeated workflow calls across separate plugin commands', () => {
    const command =
      'npx storybook tools test run --input \'{"stories":[{"storyId":"example-button--primary"}]}\'';

    const calls = parseStorybookWorkflowShellCommands([command, command]);

    expect(calls).toHaveLength(2);
    expect(calls.map((call) => call.name)).toEqual(['test-run', 'test-run']);
    expect(calls.every(workflowCallUsesStoryId)).toBe(true);
  });

  test('preserves repeated workflow calls chained in one plugin command', () => {
    const command =
      'npx storybook tools test run --input \'{"stories":[{"storyId":"example-button--primary"}]}\' && npx storybook tools test run --input \'{"stories":[{"storyId":"example-button--primary"}]}\'';

    const calls = parseStorybookWorkflowShellCommands([command]);

    expect(calls).toHaveLength(2);
    expect(calls.map((call) => call.name)).toEqual(['test-run', 'test-run']);
    expect(calls.every(workflowCallUsesStoryId)).toBe(true);
  });

  test('parses path and export story input', () => {
    const calls = parseStorybookWorkflowShellCommands([
      'npx storybook tools stories preview --input \'{"stories":[{"absoluteStoryPath":"stories/Button.stories.tsx","exportName":"Primary"}]}\'',
    ]);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.name).toBe('stories-preview');
    expect(
      calls.some((call) =>
        workflowCallIncludesStory(call, {
          absoluteStoryPath: 'stories/Button.stories.tsx',
          exportName: 'Primary',
        })
      )
    ).toBe(true);
  });

  test('parses --input=<object> next to --key value flags', () => {
    const calls = parseStorybookWorkflowShellCommands([
      'npx storybook tools test run --input=\'{"stories":[{"storyId":"example-button--primary"}]}\' --a11y false',
    ]);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.name).toBe('test-run');
    expect(calls[0]?.input.a11y).toBe(false);
    expect(
      calls.some((call) => workflowCallIncludesStory(call, { storyId: 'example-button--primary' }))
    ).toBe(true);
  });

  test('keeps backslashes literal inside single-quoted JSON payloads', () => {
    // POSIX single quotes preserve backslashes, so the CLI receives valid JSON
    // with escaped inner quotes. The tokenizer must not consume them.
    const command = [
      "npx storybook tools --port 39497 review create --input '{",
      '  "title": "Accessible ToggleSwitch component",',
      '  "description": "A switch with `role=\\"switch\\"` semantics.",',
      '  "collections": [',
      '    {',
      '      "title": "ToggleSwitch states",',
      '      "rationale": "All states.",',
      '      "storyIds": ["components-toggleswitch--off"]',
      '    }',
      '  ]',
      "}' 2>&1 | tail -30",
    ].join('\n');

    const calls = parseStorybookWorkflowShellCommands([command]);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.name).toBe('review-create');
    expect(calls[0]?.input.title).toBe('Accessible ToggleSwitch component');
    expect(calls[0]?.input.description).toBe('A switch with `role="switch"` semantics.');
    expect(calls[0]?.input.collections).toEqual([
      {
        title: 'ToggleSwitch states',
        rationale: 'All states.',
        storyIds: ['components-toggleswitch--off'],
      },
    ]);
  });

  test('resolves --input from a same-command cat heredoc', () => {
    const command = `cat > /tmp/review.json <<'EOF'
{
  "title": "New ProfileCard component",
  "description": "A new ProfileCard.",
  "collections": [
    {
      "title": "The full card",
      "rationale": "Default composition.",
      "storyIds": ["src-components-profilecard--default"]
    }
  ],
  "changedFiles": ["src/components/ProfileCard.tsx"]
}
EOF
npx storybook tools -p 36917 review create --input "$(cat /tmp/review.json)" 2>&1 | tail -20`;

    const calls = parseStorybookWorkflowShellCommands([command]);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.name).toBe('review-create');
    expect(calls[0]?.input.title).toBe('New ProfileCard component');
    expect(calls[0]?.input.collections).toEqual([
      {
        title: 'The full card',
        rationale: 'Default composition.',
        storyIds: ['src-components-profilecard--default'],
      },
    ]);
    expect(calls[0]?.input.changedFiles).toEqual(['src/components/ProfileCard.tsx']);
  });

  test('keeps an unresolvable --input value visible as a plain flag', () => {
    const calls = parseStorybookWorkflowShellCommands([
      'npx storybook tools test run --input "$(cat /tmp/input.json)"',
    ]);

    expect(calls[0]?.input).toEqual({ input: '$(cat /tmp/input.json)' });
  });

  test('parses --input placed before the toolset name', () => {
    const calls = parseStorybookWorkflowShellCommands([
      `npx storybook tools --port 43383 --input '{
  "title": "ReviewCard with date and report button",
  "description": "ReviewCard now shows a date.",
  "collections": [
    {
      "title": "ReviewCard states",
      "rationale": "Default plus report.",
      "storyIds": ["reviews-reviewcard--default"]
    }
  ],
  "changedFiles": ["src/components/ReviewCard.tsx"]
}' review create 2>&1`,
    ]);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.name).toBe('review-create');
    expect(calls[0]?.input.title).toBe('ReviewCard with date and report button');
    expect(calls[0]?.input.collections).toEqual([
      {
        title: 'ReviewCard states',
        rationale: 'Default plus report.',
        storyIds: ['reviews-reviewcard--default'],
      },
    ]);
  });

  test('does not credit ad hoc MCP invocations from the shell', () => {
    const calls = parseStorybookWorkflowShellCommands([
      'node scripts/mcp-call.mjs test-run \'{"stories":[{"storyId":"example-button--primary"}]}\'',
      'curl http://127.0.0.1:6006/mcp/stories-preview --data \'{"params":{"arguments":{"stories":[{"storyId":"example-button--secondary"}]}}}\'',
    ]);

    expect(calls).toHaveLength(0);
  });

  test('ignores shell redirections', () => {
    const calls = parseStorybookWorkflowShellCommands([
      'npx storybook tools stories changed 2>&1',
      'npx storybook tools --port 6006 test run >out.txt 2> err.log',
    ]);

    expect(calls.map((call) => call.input)).toEqual([{}, {}]);
  });

  test('does not mistake a non-shell -c flag for a bash -c wrapper', () => {
    // Regression: cc-plugin 802 (2026-07-03 CI run 28647682172) chained
    // `head -c 800` before a real stories-changed call in one compound
    // command; the parser recursed into the literal `800` as if it were a
    // `bash -c` payload and dropped the workflow call.
    const calls = parseStorybookWorkflowShellCommands([
      'sleep 3; curl -s http://localhost:40097/index.json 2>/dev/null | head -c 800; echo; echo "---changed---"; npx storybook tools --port 40097 stories changed 2>&1 | grep -v "No story files" | head -40',
      'curl -c cookies.txt http://localhost:6006/ && npx storybook tools stories changed',
      'grep -c foo bar.txt; npx storybook tools stories find-by-component --input \'{"componentPaths":["src/Badge.tsx"]}\'',
    ]);

    expect(calls.map((call) => call.name)).toEqual([
      'stories-changed',
      'stories-changed',
      'stories-find-by-component',
    ]);
  });

  test('still unwraps genuine shell wrappers around storybook tools calls', () => {
    const calls = parseStorybookWorkflowShellCommands([
      "bash -c 'npx storybook tools stories changed'",
      "/bin/sh -lc 'npx storybook tools --port 6006 test run'",
      "env bash -x -c 'npx storybook tools stories find-by-component'",
    ]);

    expect(calls.map((call) => call.name)).toEqual([
      'stories-changed',
      'test-run',
      'stories-find-by-component',
    ]);
  });

  test('parses storybook tools toolset/method pairs', () => {
    const calls = parseStorybookWorkflowShellCommands([
      'npx storybook tools test run --input \'{"stories":[{"storyId":"example-button--primary"}]}\'',
      'npx storybook tools stories find-by-component --input \'{"componentPaths":["src/Badge.tsx"]}\'',
      'npx storybook tools review create --input \'{"title":"Pass","description":"x","collections":[]}\'',
    ]);

    expect(calls.map((call) => call.name)).toEqual([
      'test-run',
      'stories-find-by-component',
      'review-create',
    ]);
    expect(calls[0]?.input).toMatchObject({
      stories: [{ storyId: 'example-button--primary' }],
    });
  });

  test('scores storybook tools --input payloads and drops the bare --json output flag', () => {
    // Verbatim from codex-plugin-gpt-6-sol-medium 803-edit-component and
    // 808-shared-infra-fallback (2026-09-24).
    const calls = parseStorybookWorkflowShellCommands([
      'npx storybook tools review create --input \'{"title":"Review date and report action","description":"The review card now shows a date and can offer a Report action.","collections":[{"title":"Review card states","rationale":"Shows the date in the standard card and the optional Report button with its click behavior.","storyIds":["reviews-reviewcard--default","reviews-reviewcard--with-report-action"]}],"changedFiles":["src/components/ReviewCard.tsx","stories/ReviewCard.stories.tsx"]}\' --json',
      'npx storybook tools test run --input \'{"stories":[{"storyId":"reviews-reviewcard--default"},{"storyId":"reviews-reviewcard--with-report-action"}]}\' --json',
      'npx storybook tools test run --stories \'[{"storyId":"components-badge--default"}]\' --json 2>&1',
    ]);

    expect(calls.map((call) => call.name)).toEqual(['review-create', 'test-run', 'test-run']);
    expect(calls[0]?.input.title).toBe('Review date and report action');
    expect(calls[0]?.input.collections).toEqual([
      {
        title: 'Review card states',
        rationale:
          'Shows the date in the standard card and the optional Report button with its click behavior.',
        storyIds: ['reviews-reviewcard--default', 'reviews-reviewcard--with-report-action'],
      },
    ]);
    expect(calls[1]?.input).toEqual({
      stories: [
        { storyId: 'reviews-reviewcard--default' },
        { storyId: 'reviews-reviewcard--with-report-action' },
      ],
    });
    expect(calls[2]?.input).toEqual({ stories: [{ storyId: 'components-badge--default' }] });
    for (const call of calls) {
      expect(call.input).not.toHaveProperty('input');
      expect(call.input).not.toHaveProperty('json');
    }
  });

  test('lets explicit --key flags override --input entries regardless of order', () => {
    const calls = parseStorybookWorkflowShellCommands([
      'npx storybook tools test run --a11y false --input \'{"a11y":true,"stories":[{"storyId":"a--b"}]}\'',
      'npx storybook tools test run --input \'{"a11y":true,"stories":[{"storyId":"a--b"}]}\' --a11y false',
    ]);

    expect(calls).toHaveLength(2);
    for (const call of calls) {
      expect(call.input).toEqual({ a11y: false, stories: [{ storyId: 'a--b' }] });
    }
  });

  test("drops the CLIs' own target and output options from the input", () => {
    const calls = parseStorybookWorkflowShellCommands([
      'npx storybook tools -p 6006 -c .storybook test run --input \'{"stories":[{"storyId":"a--b"}]}\' -o /tmp/run.json --no-attach',
      'npx storybook tools --cwd app --port=6006 test run --stories \'[{"storyId":"a--b"}]\' --output /tmp/run.md --attach --json',
    ]);

    expect(calls).toHaveLength(2);
    for (const call of calls) {
      expect(call.input).toEqual({ stories: [{ storyId: 'a--b' }] });
    }
  });

  test('does not unwrap MCP-style wrappers inside a tools --input object', () => {
    const calls = parseStorybookWorkflowShellCommands([
      'npx storybook tools test run --input \'{"arguments":{"stories":[{"storyId":"a--b"}]}}\'',
    ]);

    expect(calls[0]?.input).toEqual({ arguments: { stories: [{ storyId: 'a--b' }] } });
  });
});

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

  function codexTestRunJsonLine(output: unknown): string {
    return JSON.stringify({
      type: 'item.completed',
      item: {
        type: 'command_execution',
        command:
          'npx storybook tools test run --input \'{"stories":[{"storyId":"reviews-reviewcard--default"}]}\' --json',
        aggregated_output: `${JSON.stringify(output, null, 2)}\n`,
        exit_code: 0,
        status: 'completed',
      },
    });
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

    const output = parseWorkflowToolResults(transcript, 'test-run')[0]?.output ?? '';

    expect(output).toContain('## Passing Stories\n\n- a--b');
    expect(output).toContain('## Failing Stories\n\n### a--c\n\nexpected 1 to be 2');
    expect(output).toContain(
      '## Accessibility Violations\n\n### a--b - button-name\n\nButtons must have discernible text'
    );
    expect(output).toContain('### a--c - Error\n\naxe crashed');
    expect(output).toContain(
      '## Unhandled Errors\n\n### TypeError\n\n**Error message**: x is not a function'
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
    const transcript = JSON.stringify({
      type: 'item.completed',
      item: {
        type: 'command_execution',
        command: 'npx storybook tools test run --stories \'[{"storyId":"a--b"}]\' --json 2>&1',
        aggregated_output: `npm warn exec The following package was not found and will be installed: storybook@10.3.0\n${json}\nOutput written to /tmp/run.json\n`,
        exit_code: 0,
        status: 'completed',
      },
    });

    expect(parseWorkflowToolResults(transcript, 'test-run')[0]?.output).toBe(
      '## Passing Stories\n\n- a--b'
    );
  });

  test('renders the non-completed --json test-run outcomes', () => {
    const outputs = [
      { status: 'no-stories', notFoundMessages: ['No story with id a--b'] },
      { status: 'error', error: { message: 'dev server unreachable' } },
      { status: 'cancelled' },
    ].map(
      (output) => parseWorkflowToolResults(codexTestRunJsonLine(output), 'test-run')[0]?.output
    );

    expect(outputs).toEqual([
      'No stories found matching the provided input.\n\nNo story with id a--b',
      'Error: dev server unreachable',
      'Error: Test run was cancelled',
    ]);
  });

  test('leaves markdown and unrecognized JSON output untouched', () => {
    const markdown = JSON.stringify({
      type: 'item.completed',
      item: {
        type: 'command_execution',
        command: 'npx storybook tools test run --stories \'[{"storyId":"a--b"}]\'',
        aggregated_output: '## Passing Stories\n\n- a--b',
        exit_code: 0,
        status: 'completed',
      },
    });
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
