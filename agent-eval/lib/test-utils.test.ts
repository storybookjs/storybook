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
      'storybook ai test-run --json \'{"stories":[{"storyId":"example-button--primary"}]}\'';

    const calls = parseStorybookWorkflowShellCommands([command, command]);

    expect(calls).toHaveLength(2);
    expect(calls.map((call) => call.name)).toEqual(['test-run', 'test-run']);
    expect(calls.every(workflowCallUsesStoryId)).toBe(true);
  });

  test('preserves repeated workflow calls chained in one plugin command', () => {
    const command =
      'storybook ai test-run --json \'{"stories":[{"storyId":"example-button--primary"}]}\' && storybook ai test-run --json \'{"stories":[{"storyId":"example-button--primary"}]}\'';

    const calls = parseStorybookWorkflowShellCommands([command]);

    expect(calls).toHaveLength(2);
    expect(calls.map((call) => call.name)).toEqual(['test-run', 'test-run']);
    expect(calls.every(workflowCallUsesStoryId)).toBe(true);
  });

  test('parses storybook ai path and export JSON input', () => {
    const calls = parseStorybookWorkflowShellCommands([
      'storybook ai stories-preview --json \'{"stories":[{"absoluteStoryPath":"stories/Button.stories.tsx","exportName":"Primary"}]}\'',
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

  test('parses inline storybook ai JSON input', () => {
    const calls = parseStorybookWorkflowShellCommands([
      'storybook ai test-run --json=\'{"stories":[{"storyId":"example-button--primary"}],"a11y":false}\'',
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
      "STORYBOOK_FEATURE_AI_CLI=1 npx storybook ai --port 39497 review-create --json '{",
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

  test('resolves review-create --json from a same-command cat heredoc', () => {
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
STORYBOOK_FEATURE_AI_CLI=1 npx storybook ai -p 36917 review-create --json "$(cat /tmp/review.json)" 2>&1 | tail -20`;

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

  test('parses --json placed before the workflow command name', () => {
    const calls = parseStorybookWorkflowShellCommands([
      `STORYBOOK_FEATURE_AI_CLI=1 npx storybook ai --port 43383 --json '{
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
}' review-create 2>&1`,
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

  test('ignores shell redirections in storybook ai commands', () => {
    const calls = parseStorybookWorkflowShellCommands([
      'STORYBOOK_FEATURE_AI_CLI=1 npx storybook ai stories-changed 2>&1',
      'npx storybook ai --port 6006 test-run >out.txt 2> err.log',
    ]);

    expect(calls).toHaveLength(2);
    expect(calls[0]?.input).toEqual({});
    expect(calls[1]?.input).not.toHaveProperty('json');
  });

  test('does not mistake a non-shell -c flag for a bash -c wrapper', () => {
    // Regression: cc-plugin 802 (2026-07-03 CI run 28647682172) chained
    // `head -c 800` before a real stories-changed call in one compound
    // command; the parser recursed into the literal `800` as if it were a
    // `bash -c` payload and dropped the workflow call.
    const calls = parseStorybookWorkflowShellCommands([
      'sleep 3; curl -s http://localhost:40097/index.json 2>/dev/null | head -c 800; echo; echo "---changed---"; STORYBOOK_FEATURE_AI_CLI=1 npx storybook ai --port 40097 stories-changed 2>&1 | grep -v "No story files" | head -40',
      'curl -c cookies.txt http://localhost:6006/ && npx storybook ai stories-changed',
      'grep -c foo bar.txt; npx storybook ai stories-find-by-component --json \'{"componentPaths":["src/Badge.tsx"]}\'',
    ]);

    expect(calls.map((call) => call.name)).toEqual([
      'stories-changed',
      'stories-changed',
      'stories-find-by-component',
    ]);
  });

  test('still unwraps genuine shell wrappers around storybook ai calls', () => {
    const calls = parseStorybookWorkflowShellCommands([
      "bash -c 'npx storybook ai stories-changed'",
      "/bin/sh -lc 'npx storybook ai --port 6006 test-run'",
      "env bash -x -c 'npx storybook ai stories-find-by-component'",
    ]);

    expect(calls.map((call) => call.name)).toEqual([
      'stories-changed',
      'test-run',
      'stories-find-by-component',
    ]);
  });

  test('parses storybook tools toolset/method pairs', () => {
    const calls = parseStorybookWorkflowShellCommands([
      'npx storybook tools test run --json \'{"stories":[{"storyId":"example-button--primary"}]}\'',
      'npx storybook tools stories find-by-component --json \'{"componentPaths":["src/Badge.tsx"]}\'',
      'npx storybook tools review create --json \'{"title":"Pass","description":"x","collections":[]}\'',
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

  test('extracts Claude plugin-path results from storybook ai shell invocations', () => {
    const transcript = [
      claudeToolUseLine('toolu_1', 'Bash', {
        command: 'STORYBOOK_FEATURE_AI_CLI=1 npx storybook ai --port 6006 test-run',
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
          command: "/bin/bash -lc 'npx storybook ai --port 6006 test-run'",
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
