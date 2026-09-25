import { describe, expect, test } from 'vitest';

import { parseStorybookWorkflowShellCommands, workflowCallMatchesName } from './shell-parse.ts';

// Not a static import: tsc would then check the core source against this
// package's stricter `noUncheckedIndexedAccess`.
const toolTokensUrl = new URL('../../code/core/src/cli/tools/tool-tokens.ts', import.meta.url);
const { parseToolsTokens } = (await import(toolTokensUrl.href)) as {
  parseToolsTokens: (
    tokens: string[]
  ) => { ok: true; help: boolean; args: Record<string, unknown> } | { ok: false };
};

function shellQuote(token: string): string {
  return `'${token.replaceAll("'", `'\\''`)}'`;
}

describe('storybook tools arguments after the tool name', () => {
  // `input: undefined` marks an invocation the CLI answers with help or an error
  // instead of running the tool.
  const cases: { tokens: string[]; input: Record<string, unknown> | undefined }[] = [
    { tokens: [], input: {} },
    { tokens: ['--a11y', 'false'], input: { a11y: false } },
    { tokens: ['--a11y=false'], input: { a11y: false } },
    { tokens: ['--verbose'], input: { verbose: true } },
    { tokens: ['--delta', '-1'], input: { delta: -1 } },
    { tokens: ['--grep', '-h'], input: { grep: '-h' } },
    { tokens: ['--title', 'plain text'], input: { title: 'plain text' } },
    { tokens: ['--title', 'a=b'], input: { title: 'a=b' } },
    { tokens: ['--title=a=b'], input: { title: 'a=b' } },
    { tokens: ['--value', 'null'], input: { value: null } },
    {
      tokens: ['--stories', '[{"storyId":"a--b"}]'],
      input: { stories: [{ storyId: 'a--b' }] },
    },
    {
      tokens: ['--input', '{"a11y":true,"stories":[{"storyId":"a--b"}]}', '--a11y', 'false'],
      input: { a11y: false, stories: [{ storyId: 'a--b' }] },
    },
    {
      tokens: ['--a11y', 'false', '--input', '{"a11y":true,"stories":[{"storyId":"a--b"}]}'],
      input: { a11y: false, stories: [{ storyId: 'a--b' }] },
    },
    {
      tokens: ['--input={"title":"T","url":"/?a=b"}'],
      input: { title: 'T', url: '/?a=b' },
    },
    {
      tokens: ['--input', '{"arguments":{"stories":[]}}'],
      input: { arguments: { stories: [] } },
    },
    {
      tokens: ['--json', '--attach', '-o', '/tmp/run.md', '--output=/tmp/run.json'],
      input: {},
    },
    { tokens: ['--no-attach', '--output', '/tmp/run.md'], input: {} },
    {
      tokens: ['--port', '6006', '--cwd', 'app', '--config-dir', '.storybook'],
      input: { port: 6006, cwd: 'app', 'config-dir': '.storybook' },
    },
    { tokens: ['--help'], input: undefined },
    { tokens: ['-h'], input: undefined },
    { tokens: ['--a11y', 'false', '--help'], input: undefined },
    { tokens: ['-a11y', 'false'], input: undefined },
    { tokens: ['-p', '6006'], input: undefined },
    { tokens: ['stories.json'], input: undefined },
    { tokens: ['--componentPaths', 'src/A.tsx', 'src/B.tsx'], input: undefined },
    { tokens: ['--'], input: undefined },
    { tokens: ['--=x'], input: undefined },
    { tokens: ['--json=true'], input: undefined },
    { tokens: ['--attach', '--no-attach'], input: undefined },
    { tokens: ['-o'], input: undefined },
    { tokens: ['-o', '--json'], input: undefined },
    { tokens: ['--output='], input: undefined },
    { tokens: ['--input'], input: undefined },
    { tokens: ['--input', '{"title":'], input: undefined },
    { tokens: ['--input', '["a--b"]'], input: undefined },
  ];

  for (const { tokens, input } of cases) {
    test(tokens.join(' ') || '(no arguments)', () => {
      const calls = parseStorybookWorkflowShellCommands([
        ['npx storybook tools test run', ...tokens.map(shellQuote)].join(' '),
      ]);
      const parsed = parseToolsTokens(tokens);

      expect(calls.map((call) => call.input)).toEqual(input === undefined ? [] : [input]);
      expect(parsed.ok && !parsed.help ? parsed.args : undefined).toEqual(input);
    });
  }
});

describe('parseStorybookWorkflowShellCommands', () => {
  test('names the call after the toolset and tool', () => {
    const calls = parseStorybookWorkflowShellCommands([
      'npx storybook tools test run',
      'npx storybook tools stories find-by-component --componentPaths \'["src/Badge.tsx"]\'',
      'npx storybook tools review create --input \'{"title":"Pass","collections":[]}\'',
      'npx storybook tools docs show-story --id button--primary',
    ]);

    expect(calls).toEqual([
      { name: 'test-run', input: {}, source: 'cli' },
      {
        name: 'stories-find-by-component',
        input: { componentPaths: ['src/Badge.tsx'] },
        source: 'cli',
      },
      { name: 'review-create', input: { title: 'Pass', collections: [] }, source: 'cli' },
      { name: 'docs-show-story', input: { id: 'button--primary' }, source: 'cli' },
    ]);
  });

  test('reads the options before the toolset name as commander does', () => {
    const calls = parseStorybookWorkflowShellCommands([
      'npx storybook tools -p 6006 -c .storybook --no-attach --json test run --a11y false',
      'npx storybook tools --cwd app --port=6006 -o /tmp/run.md test run',
      'npx storybook tools --input \'{"a11y":true,"stories":[]}\' test run --a11y false',
      'npx storybook tools --input=\'{"stories":[]}\' test run',
    ]);

    expect(calls.map((call) => call.input)).toEqual([
      { a11y: false },
      {},
      { a11y: false, stories: [] },
      { stories: [] },
    ]);
  });

  test('does not record help requests before the toolset name', () => {
    const calls = parseStorybookWorkflowShellCommands([
      'npx storybook tools --help test run',
      'npx storybook tools -h review create',
      'npx storybook tools help test run',
    ]);

    expect(calls).toEqual([]);
  });

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

  test('records every call, across commands and chained within one command', () => {
    const command = 'npx storybook tools test run --stories \'[{"storyId":"a--b"}]\'';

    const calls = parseStorybookWorkflowShellCommands([command, `${command} && ${command}`]);

    expect(calls.map((call) => call.input)).toEqual([
      { stories: [{ storyId: 'a--b' }] },
      { stories: [{ storyId: 'a--b' }] },
      { stories: [{ storyId: 'a--b' }] },
    ]);
  });

  test('parses the --input payloads and bare --json flag agents send', () => {
    // Verbatim from codex-plugin-gpt-6-sol-medium 803-edit-component and
    // 808-shared-infra-fallback (2026-09-24).
    const calls = parseStorybookWorkflowShellCommands([
      'npx storybook tools review create --input \'{"title":"Review date and report action","description":"The review card now shows a date and can offer a Report action.","collections":[{"title":"Review card states","rationale":"Shows the date in the standard card and the optional Report button with its click behavior.","storyIds":["reviews-reviewcard--default","reviews-reviewcard--with-report-action"]}],"changedFiles":["src/components/ReviewCard.tsx","stories/ReviewCard.stories.tsx"]}\' --json',
      'npx storybook tools test run --input \'{"stories":[{"storyId":"reviews-reviewcard--default"},{"storyId":"reviews-reviewcard--with-report-action"}]}\' --json',
      'npx storybook tools test run --stories \'[{"storyId":"components-badge--default"}]\' --json 2>&1',
    ]);

    expect(calls.map((call) => call.input)).toEqual([
      {
        title: 'Review date and report action',
        description: 'The review card now shows a date and can offer a Report action.',
        collections: [
          {
            title: 'Review card states',
            rationale:
              'Shows the date in the standard card and the optional Report button with its click behavior.',
            storyIds: ['reviews-reviewcard--default', 'reviews-reviewcard--with-report-action'],
          },
        ],
        changedFiles: ['src/components/ReviewCard.tsx', 'stories/ReviewCard.stories.tsx'],
      },
      {
        stories: [
          { storyId: 'reviews-reviewcard--default' },
          { storyId: 'reviews-reviewcard--with-report-action' },
        ],
      },
      { stories: [{ storyId: 'components-badge--default' }] },
    ]);
  });

  test('keeps backslashes literal inside single-quoted JSON payloads', () => {
    const command = [
      "npx storybook tools --port 39497 review create --input '{",
      '  "title": "Accessible ToggleSwitch component",',
      '  "description": "A switch with `role=\\"switch\\"` semantics.",',
      '  "collections": [{ "title": "States", "storyIds": ["components-toggleswitch--off"] }]',
      "}' 2>&1 | tail -30",
    ].join('\n');

    const calls = parseStorybookWorkflowShellCommands([command]);

    expect(calls.map((call) => call.input)).toEqual([
      {
        title: 'Accessible ToggleSwitch component',
        description: 'A switch with `role="switch"` semantics.',
        collections: [{ title: 'States', storyIds: ['components-toggleswitch--off'] }],
      },
    ]);
  });

  test('joins backslash-continued lines', () => {
    const command = [
      'npx storybook tools review create --port 45723 --json \\',
      " --title 'New ToggleSwitch' \\",
      ' --collections \'[{"title":"States","storyIds":["a--b"]}]\'',
    ].join('\n');

    const calls = parseStorybookWorkflowShellCommands([command]);

    expect(calls.map((call) => call.input)).toEqual([
      {
        port: 45723,
        title: 'New ToggleSwitch',
        collections: [{ title: 'States', storyIds: ['a--b'] }],
      },
    ]);
  });

  test('resolves $(cat path) from a same-command cat heredoc', () => {
    const command = `cat > /tmp/review.json <<'EOF'
{
  "title": "New ProfileCard component",
  "collections": [{ "title": "The full card", "storyIds": ["profilecard--default"] }]
}
EOF
npx storybook tools -p 36917 review create --input "$(cat /tmp/review.json)" 2>&1 | tail -20
npx storybook tools review create --input="$(cat /tmp/review.json)" --title Override`;

    const calls = parseStorybookWorkflowShellCommands([command]);

    const collections = [{ title: 'The full card', storyIds: ['profilecard--default'] }];
    expect(calls.map((call) => call.input)).toEqual([
      { title: 'New ProfileCard component', collections },
      { title: 'Override', collections },
    ]);
  });

  test('keeps an --input the shell expanded out of view as a plain argument', () => {
    const calls = parseStorybookWorkflowShellCommands([
      'npx storybook tools test run --input "$(cat /tmp/input.json)"',
      'npx storybook tools test run --input "$PAYLOAD" --a11y false',
    ]);

    expect(calls.map((call) => call.input)).toEqual([
      { input: '$(cat /tmp/input.json)' },
      { input: '$PAYLOAD', a11y: false },
    ]);
  });

  test('ignores shell redirections', () => {
    const calls = parseStorybookWorkflowShellCommands([
      'npx storybook tools stories changed 2>&1',
      'npx storybook tools --port 6006 test run >out.txt 2> err.log',
      'npx storybook tools test run --a11y false > /tmp/out.md',
    ]);

    expect(calls.map((call) => call.input)).toEqual([{}, {}, { a11y: false }]);
  });

  test('does not credit ad hoc MCP invocations from the shell', () => {
    const calls = parseStorybookWorkflowShellCommands([
      'node scripts/mcp-call.mjs test-run \'{"stories":[{"storyId":"example-button--primary"}]}\'',
      'curl http://127.0.0.1:6006/mcp/stories-preview --data \'{"params":{"arguments":{"stories":[{"storyId":"example-button--secondary"}]}}}\'',
    ]);

    expect(calls).toHaveLength(0);
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

  test('unwraps genuine shell wrappers around storybook tools calls', () => {
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
});
