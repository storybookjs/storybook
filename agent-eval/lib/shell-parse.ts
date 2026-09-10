// Pure shell-command parsing for plugin-path workflow scoring: no vitest, no
// filesystem access. This file is copied into eval sandboxes next to
// test-utils.ts, so it must stay dependency-free.

export type StorybookWorkflowCall = {
  name: string;
  input: Record<string, unknown>;
  source: 'mcp' | 'storybook-ai' | 'cli';
};

// `storybook skills write-story` serves the same document the MCP channel
// exposes as the get-storybook-story-instructions tool. Assertions ask by that
// historic name; this matcher owns the cross-channel equivalence. Remove the
// alias once the MCP tool and the skill share one name (or the tool is
// retired) — until then it keeps the assertions channel-agnostic.
export function workflowCallMatchesName(call: StorybookWorkflowCall, name: string): boolean {
  if (call.name === name) {
    return true;
  }
  return (
    name === 'get-storybook-story-instructions' &&
    call.name === 'skills-get' &&
    (call.input.id === 'write-story' || call.input.all === true)
  );
}

export const STORYBOOK_WORKFLOW_TOOL_NAMES = [
  'docs-list',
  'docs-show',
  'docs-show-story',
  'get-storybook-story-instructions',
  'review-create',
  'stories-changed',
  'stories-find-by-component',
  'stories-preview',
  'test-run',
] as const;

const SHELL_COMMAND_SEPARATORS = new Set(['&&', '||', ';', '|']);

// MCP-ish payload wrappers observed across agents: the workflow input may sit
// directly on the object, under one of these keys, or under `params.<key>`.
const WORKFLOW_INPUT_KEYS = ['arguments', 'input', 'args'] as const;

export function parseStorybookWorkflowShellCommands(commands: string[]): StorybookWorkflowCall[] {
  return commands.flatMap(parsePluginWorkflowCalls);
}

export function normalizeStorybookWorkflowName(
  name: string
): (typeof STORYBOOK_WORKFLOW_TOOL_NAMES)[number] | undefined {
  return STORYBOOK_WORKFLOW_TOOL_NAMES.find(
    (toolName) =>
      name === toolName ||
      name.endsWith(`__${toolName}`) ||
      name.endsWith(`.${toolName}`) ||
      name.endsWith(`/${toolName}`)
  );
}

export function getNestedWorkflowInput(
  record: Record<string, unknown>
): Record<string, unknown> | undefined {
  for (const key of WORKFLOW_INPUT_KEYS) {
    const value = record[key];
    if (isRecord(value)) {
      return value;
    }
  }

  return undefined;
}

export function isSameWorkflowCall(
  first: StorybookWorkflowCall,
  second: StorybookWorkflowCall
): boolean {
  return first.name === second.name && JSON.stringify(first.input) === JSON.stringify(second.input);
}

function parsePluginWorkflowCalls(command: string): StorybookWorkflowCall[] {
  const nestedCommand = getNestedShellCommand(command);
  if (nestedCommand !== undefined) {
    return parsePluginWorkflowCalls(nestedCommand);
  }

  // Only genuine `storybook ai` / `storybook tools` CLI invocations count as plugin
  // workflow calls. Raw curl requests to the MCP endpoint (or ad hoc helper scripts)
  // are deliberately not recognized: agents must use the documented CLI.
  return parseStorybookCliWorkflowCalls(command);
}

function parseStorybookCliWorkflowCalls(command: string): StorybookWorkflowCall[] {
  const tokens = tokenizeShellCommand(command);
  const heredocs = extractCatHeredocs(command);
  const calls: StorybookWorkflowCall[] = [];

  for (let index = 0; index < tokens.length - 1; index += 1) {
    if (tokens[index] !== 'storybook') {
      continue;
    }

    const cli = tokens[index + 1];
    if (cli === 'skills') {
      // Record the literal invocation; which skill serves which workflow document
      // is workflowCallMatchesName's concern. A help request prints usage instead
      // of the skill, so it does not count — same rule as the ai/tools branch below.
      const segment = segmentUntilSeparator(tokens, index + 2);
      const [first, ...rest] = segment;
      const all = first === '--all' && rest.length === 0;
      const single =
        first !== undefined &&
        !first.startsWith('-') &&
        !rest.includes('--all') &&
        !rest.includes('--help') &&
        !rest.includes('-h');
      if (all || single) {
        calls.push({
          name: 'skills-get',
          input: all ? { all: true } : { id: first },
          source: 'cli',
        });
        index += 1 + segment.length;
      }
      continue;
    }
    if (cli !== 'ai' && cli !== 'tools') {
      continue;
    }

    const invocation = parseStorybookCliInvocation(tokens.slice(index + 2), cli, heredocs);
    if (invocation !== undefined) {
      calls.push(invocation.call);
      index += invocation.consumed + 1;
    }
  }

  return calls;
}

function segmentUntilSeparator(tokens: string[], start: number): string[] {
  const end = tokens.findIndex(
    (token, index) => index >= start && SHELL_COMMAND_SEPARATORS.has(token)
  );
  return tokens.slice(start, end === -1 ? tokens.length : end);
}

function parseStorybookCliInvocation(
  cliArgs: string[],
  cli: 'ai' | 'tools',
  heredocs: Map<string, string>
): { call: StorybookWorkflowCall; consumed: number } | undefined {
  const endIndex = cliArgs.findIndex(
    (token, index) =>
      SHELL_COMMAND_SEPARATORS.has(token) || (token === 'storybook' && cliArgs[index + 1] === cli)
  );
  const consumed = endIndex === -1 ? cliArgs.length : endIndex;
  const segment = cliArgs.slice(0, consumed);

  if (segment.includes('--help') || segment.includes('-h') || segment[0] === 'help') {
    return undefined;
  }

  const command = findWorkflowCommand(segment, cli);
  if (command === undefined) {
    return undefined;
  }

  const commandTokenCount = cli === 'tools' ? 2 : 1;
  const inputTokens = [
    ...segment.slice(0, command.endIndex - commandTokenCount),
    ...segment.slice(command.endIndex),
  ];

  return {
    call: {
      name: command.name,
      input: parseStorybookAiInput(inputTokens, heredocs),
      source: 'storybook-ai',
    },
    consumed,
  };
}

function findWorkflowCommand(
  segment: string[],
  cli: 'ai' | 'tools'
): { name: (typeof STORYBOOK_WORKFLOW_TOOL_NAMES)[number]; endIndex: number } | undefined {
  if (cli === 'tools') {
    for (let index = 0; index < segment.length - 1; index += 1) {
      const first = segment[index];
      const second = segment[index + 1];
      if (first === undefined || second === undefined) {
        continue;
      }
      const name = normalizeStorybookWorkflowName(`${first}-${second}`);
      if (name !== undefined) {
        return { name, endIndex: index + 2 };
      }
    }
    return undefined;
  }

  const commandIndex = segment.findIndex(
    (token) => normalizeStorybookWorkflowName(token) !== undefined
  );
  const commandToken = commandIndex === -1 ? undefined : segment[commandIndex];
  const name =
    commandToken === undefined ? undefined : normalizeStorybookWorkflowName(commandToken);

  if (name === undefined || commandIndex === -1) {
    return undefined;
  }

  return { name, endIndex: commandIndex + 1 };
}

// Matches the shell binary of a `bash -c '…'`-style wrapper, with or without a
// path prefix (`/bin/sh`). `env bash -c` also works, but only because `bash`
// itself is the token preceding `-c` — `env` is never matched.
const SHELL_BINARY_PATTERN = /^(?:.*\/)?(?:sh|bash|zsh|dash|ksh)$/;

function getNestedShellCommand(command: string): string | undefined {
  const tokens = tokenizeShellCommand(command);
  for (let index = 0; index < tokens.length - 1; index += 1) {
    if (tokens[index] !== '-c' && tokens[index] !== '-lc') {
      continue;
    }

    // Only a `-c` that belongs to a shell binary wraps a nested command;
    // `head -c 800`, `curl -c jar`, or `grep -c foo` must stay literal.
    // Walk back over other dash flags so `bash -x -c '…'` still counts.
    // Known limitation: a flag with a separate value argument (e.g.
    // `bash -O extglob -c '…'`) stops the walk-back at the value and the
    // wrapper is missed — accepted, agents have not been observed doing that.
    let binaryIndex = index - 1;
    while (binaryIndex >= 0 && tokens[binaryIndex]?.startsWith('-')) {
      binaryIndex -= 1;
    }
    if (binaryIndex >= 0 && SHELL_BINARY_PATTERN.test(tokens[binaryIndex] ?? '')) {
      return tokens[index + 1];
    }
  }

  return undefined;
}

// `2>&1`, `>`, `>>out.txt`, `2>err.log`, `&>log`, `<in.txt`, …
const SHELL_REDIRECTION_PATTERN = /^(\d*|&)>{1,2}|^</;
// Redirections that already name their target (`2>&1`, `>out.txt`) consume one
// token; a bare operator (`>`, `2>`, `<`) also consumes the following token.
const BARE_SHELL_REDIRECTION_PATTERN = /^((\d*|&)>{1,2}|<)$/;

function isShellRedirection(token: string): boolean {
  return SHELL_REDIRECTION_PATTERN.test(token);
}

function parseStorybookAiInput(
  tokens: string[],
  heredocs: Map<string, string>
): Record<string, unknown> {
  const input: Record<string, unknown> = {};
  let index = 0;

  while (index < tokens.length) {
    const token = tokens[index];
    if (token === undefined) {
      index += 1;
      continue;
    }

    if (isShellRedirection(token)) {
      index += BARE_SHELL_REDIRECTION_PATTERN.test(token) ? 2 : 1;
      continue;
    }

    if (token.startsWith('--')) {
      index = parseFlagToken(tokens, index, input, heredocs);
      continue;
    }

    // Positional argument: the CLI accepts the JSON payload bare.
    mergeJsonInput(input, parseCliValue(token, heredocs));
    index += 1;
  }

  return input;
}

// Parse one `--flag`, `--flag=value`, or `--flag value` starting at `index`;
// returns the index of the next unconsumed token. `--json` values merge into
// the input object, every other flag assigns its (JSON-parsed) value.
function parseFlagToken(
  tokens: string[],
  index: number,
  input: Record<string, unknown>,
  heredocs: Map<string, string>
): number {
  const token = tokens[index] ?? '';
  const [rawKey = '', inlineValue] = token.slice(2).split('=', 2);
  if (rawKey.length === 0) {
    return index + 1;
  }

  const key = kebabToCamel(rawKey);
  const assign = (value: unknown) => {
    if (key === 'json') {
      mergeJsonInput(input, value);
    } else {
      input[key] = value;
    }
  };

  if (inlineValue !== undefined) {
    assign(parseCliValue(inlineValue, heredocs));
    return index + 1;
  }

  const next = tokens[index + 1];
  if (next !== undefined && !next.startsWith('-') && !isShellRedirection(next)) {
    assign(parseCliValue(next, heredocs));
    return index + 2;
  }

  assign(true);
  return index + 1;
}

function mergeJsonInput(input: Record<string, unknown>, value: unknown): void {
  if (isRecord(value)) {
    Object.assign(input, unwrapWorkflowInput(value));
    return;
  }

  input.json = value;
}

function parseCliValue(value: string, heredocs: Map<string, string>): unknown {
  const catPath = CAT_SUBSTITUTION.exec(value.trim())?.[1];
  const fromHeredoc = catPath === undefined ? undefined : heredocs.get(catPath);
  const payload = fromHeredoc ?? value;
  try {
    return JSON.parse(payload) as unknown;
  } catch {
    return payload;
  }
}

const CAT_SUBSTITUTION = /^\$\(\s*cat\s+(\S+)\s*\)$/;

function extractCatHeredocs(command: string): Map<string, string> {
  const files = new Map<string, string>();
  const pattern = /cat\s+>\s+(\S+)\s+<<(['"]?)(\w+)\2\n([\s\S]*?)\n\3\b/g;
  for (const match of command.matchAll(pattern)) {
    const path = match[1];
    const body = match[4];
    if (path !== undefined && body !== undefined) {
      files.set(path, body);
    }
  }
  return files;
}

function kebabToCamel(value: string): string {
  return value.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

function unwrapWorkflowInput(value: Record<string, unknown>): Record<string, unknown> {
  const direct = getNestedWorkflowInput(value);
  if (direct !== undefined) {
    return direct;
  }

  const params = value.params;
  if (isRecord(params)) {
    return getNestedWorkflowInput(params) ?? value;
  }

  return value;
}

// Known limitation: a `storybook ai` invocation nested inside `$(...)` is not
// recognized. `$(cat path)` is resolved when that path was written by a
// `cat > path <<TAG` heredoc in the same command.
function tokenizeShellCommand(command: string): string[] {
  const tokens: string[] = [];
  let token = '';
  let quote: '"' | "'" | undefined;
  let escaping = false;

  for (let index = 0; index < command.length; index += 1) {
    const char = command[index];
    if (char === undefined) {
      continue;
    }

    // POSIX: inside single quotes everything is literal, including backslashes.
    // Agents rely on this when passing JSON payloads (e.g. --json '{"a": "\"x\""}').
    if (quote === "'") {
      if (char === "'") {
        quote = undefined;
      } else {
        token += char;
      }
      continue;
    }

    if (escaping) {
      token += char;
      escaping = false;
      continue;
    }

    if (char === '\\') {
      escaping = true;
      continue;
    }

    if (quote === '"') {
      if (char === '"') {
        quote = undefined;
      } else {
        token += char;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (char === '&' && command[index + 1] === '&') {
      pushToken();
      tokens.push('&&');
      index += 1;
      continue;
    }

    if (char === '|' && command[index + 1] === '|') {
      pushToken();
      tokens.push('||');
      index += 1;
      continue;
    }

    if (char === ';' || char === '|') {
      pushToken();
      tokens.push(char);
      continue;
    }

    if (/\s/.test(char)) {
      pushToken();
      continue;
    }

    token += char;
  }

  pushToken();
  return tokens;

  function pushToken(): void {
    if (token.length === 0) {
      return;
    }
    tokens.push(token);
    token = '';
  }
}

export function parseJson(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return undefined;
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
