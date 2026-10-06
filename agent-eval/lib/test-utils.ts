import { execFile, spawn } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

import { loadTranscript } from '@vercel/agent-eval';
import type { Transcript } from '@vercel/agent-eval';
import { expect } from 'vitest';

import {
  getNestedWorkflowInput,
  isSameWorkflowCall,
  normalizeStorybookWorkflowName,
  parseJson,
  parseStorybookWorkflowShellCommands,
  workflowCallMatchesName,
} from './shell-parse.ts';
import type { StorybookWorkflowCall } from './shell-parse.ts';
import { isRecord } from './utils/type.ts';

// Re-exported, not merely used: #test-utils is the only module an EVAL.ts can
// reach from inside a sandbox, so anything evals need has to surface here.
export { isRecord, parseJson, parseStorybookWorkflowShellCommands, workflowCallMatchesName };
export type { StorybookWorkflowCall };

const AGENT_CONTEXT_PATH = '__agent_eval__/agent.json';
const RESULTS_PATH = '__agent_eval__/results.json';
const TRANSCRIPT_PATH = '__agent_eval__/transcript.txt';

type AgentContext = {
  agent?: unknown;
  integration?: unknown;
};

type EvalContext = {
  agent: string;
  // 'none' is the agentic-reference bare control (no Storybook tooling flavor);
  // see lib/templates.ts. Plugin-only helpers below treat it as "not plugin".
  integration: 'mcp' | 'plugin' | 'none';
};

type AgentEvalResults = {
  o11y?: {
    shellCommands?: Array<{
      command?: unknown;
    }>;
  } | null;
};

let cachedStorybookWorkflowCalls: StorybookWorkflowCall[] | undefined;

export type StoryInputExpectation = {
  absoluteStoryPath?: string;
  exportName?: string;
  storyId?: string;
};

export function getEvalContext(): EvalContext {
  const agentContext = readAgentContext();
  const { agent, integration } = agentContext;

  if (typeof agent !== 'string') {
    throw new Error(
      'Expected ' + AGENT_CONTEXT_PATH + ' to contain an agent name. Received: ' + String(agent)
    );
  }

  if (integration !== 'mcp' && integration !== 'plugin' && integration !== 'none') {
    throw new Error(
      'Expected ' +
        AGENT_CONTEXT_PATH +
        ' to contain an integration. Received: ' +
        String(integration)
    );
  }

  return { agent, integration };
}

export function getTranscript(agent = getEvalContext().agent): Transcript {
  const raw = readFileSync(TRANSCRIPT_PATH, 'utf8');
  return loadTranscript(raw, agent);
}

export function getShellCommands(): string[] {
  const results = JSON.parse(readFileSync(RESULTS_PATH, 'utf8')) as AgentEvalResults;
  return (
    results.o11y?.shellCommands?.flatMap((shellCommand) =>
      typeof shellCommand.command === 'string' ? [shellCommand.command] : []
    ) ?? []
  );
}

export function getStorybookWorkflowCalls(): StorybookWorkflowCall[] {
  if (cachedStorybookWorkflowCalls !== undefined) {
    return cachedStorybookWorkflowCalls;
  }

  const { integration } = getEvalContext();

  if (integration === 'plugin') {
    cachedStorybookWorkflowCalls = parseStorybookWorkflowShellCommands(getShellCommands());
    return cachedStorybookWorkflowCalls;
  }

  const parsedCalls = getParsedMcpWorkflowCalls();
  const rawCalls = getRawCodexMcpWorkflowCalls();
  cachedStorybookWorkflowCalls = mergeMcpWorkflowCalls(parsedCalls, rawCalls);
  return cachedStorybookWorkflowCalls;
}

export function getWorkflowCalls(name: string): StorybookWorkflowCall[] {
  return getStorybookWorkflowCalls().filter((call) => workflowCallMatchesName(call, name));
}

export function expectWorkflowCalls(expectedNames: string[]): void {
  for (const name of expectedNames) {
    expect(getWorkflowCalls(name).length, `Expected ${name} to be called`).toBeGreaterThan(0);
  }
}

export function expectFinalResponseContains(substrings: string[]): void {
  const finalMessage = getFinalAssistantMessage() ?? '';
  for (const substring of substrings) {
    expect(finalMessage, `Expected the final response to mention "${substring}"`).toContain(
      substring
    );
  }
}

export function expectFinalResponseMatches(patterns: RegExp[]): void {
  const finalMessage = getFinalAssistantMessage() ?? '';
  for (const pattern of patterns) {
    expect(finalMessage, `Expected the final response to match ${pattern}`).toMatch(pattern);
  }
}

export function expectDisplayReviewForVisualChange(): void {
  const displayReview = getWorkflowCalls('review-create').at(-1);
  if (displayReview === undefined) {
    expect.fail('Expected review-create to be called');
  }

  expectValidDisplayReviewPayload(displayReview.input);
  expectFinalResponseSharesReviewLink();
}

// Trigger correctness: a pure non-visual refactor must NOT publish a review,
// and the final response must not pretend there is one.
export function expectNoDisplayReview(): void {
  const displayReviewCalls = getWorkflowCalls('review-create');
  expect(
    displayReviewCalls.length,
    `Expected review-create NOT to be called for a non-visual change. Received payloads: ${JSON.stringify(
      displayReviewCalls.map((call) => call.input)
    )}`
  ).toBe(0);

  expect(
    getFinalAssistantMessage() ?? '',
    'Final response must not link to the Storybook review page for a non-visual change'
  ).not.toMatch(/[?&]path=\/review\//);
}

// Browse request: the review is resolved from the live story index, so the
// payload must pass an empty changedFiles array — no code changed.
// (changedFiles is required in the schema; `[]` is the explicit browse-mode
// value.)
export function expectDisplayReviewForBrowseRequest(): void {
  const displayReview = getWorkflowCalls('review-create').at(-1);
  if (displayReview === undefined) {
    expect.fail('Expected review-create to be called');
  }

  expectValidDisplayReviewCollections(displayReview.input);
  expect(
    displayReview.input.changedFiles,
    'Browse-request review-create must pass changedFiles: []'
  ).toEqual([]);
  expectFinalResponseSharesReviewLink();
}

// Hard completeness floor: every story exported from the story files written
// during the run must appear in the published review — curation may group
// stories, never omit them. Assumes the template starts without story files,
// so every story file on disk was created by the agent.
export function expectAllStoryExportsInDisplayReview(): void {
  const displayReview = getWorkflowCalls('review-create').at(-1);
  if (displayReview === undefined) {
    expect.fail('Expected review-create to be called');
  }

  const payloadStoryIds = getDisplayReviewStoryIds(displayReview.input);
  const storyFiles = findStoryFiles('.');
  expect(storyFiles.length, 'Expected the agent to write at least one story file').toBeGreaterThan(
    0
  );

  for (const storyFile of storyFiles) {
    for (const exportName of getStoryExportNames(readFileSync(storyFile, 'utf8'))) {
      const suffix = `--${kebabCase(exportName)}`;
      expect(
        payloadStoryIds.some((storyId) => storyId.endsWith(suffix)),
        `Expected story "${exportName}" from ${storyFile} in the review-create payload. Received storyIds: ${JSON.stringify(payloadStoryIds)}`
      ).toBe(true);
    }
  }
}

// Targeted completeness floor: the stories the task is about must appear in
// the published review. Deliberately weaker than the every-new-story rule of
// expectAllStoryExportsInDisplayReview, for fixtures with pre-existing
// stories the agent may legitimately leave out of the review.
export function expectStoryIdsInDisplayReview(idSubstrings: string[]): void {
  const displayReview = getWorkflowCalls('review-create').at(-1);
  if (displayReview === undefined) {
    expect.fail('Expected review-create to be called');
  }

  const storyIds = getDisplayReviewStoryIds(displayReview.input);
  for (const substring of idSubstrings) {
    expect(
      storyIds.some((storyId) => storyId.includes(substring)),
      `Expected a storyId containing "${substring}" in the review-create payload. Received storyIds: ${JSON.stringify(storyIds)}`
    ).toBe(true);
  }
}

function getDisplayReviewStoryIds(input: Record<string, unknown>): string[] {
  if (!Array.isArray(input.collections)) {
    return [];
  }

  return input.collections.flatMap((collection) =>
    isRecord(collection) && Array.isArray(collection.storyIds)
      ? collection.storyIds.filter((storyId): storyId is string => typeof storyId === 'string')
      : []
  );
}

const STORY_FILE_PATTERN = /\.stories\.[jt]sx?$/;
const SKIPPED_SCAN_DIRECTORIES = new Set(['node_modules', 'dist', '.git', '__agent_eval__']);

function findStoryFiles(rootDir: string): string[] {
  return readdirSync(rootDir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(rootDir, entry.name);
    if (entry.isDirectory()) {
      return SKIPPED_SCAN_DIRECTORIES.has(entry.name) ? [] : findStoryFiles(entryPath);
    }
    return STORY_FILE_PATTERN.test(entry.name) ? [entryPath] : [];
  });
}

function getStoryExportNames(storyFileSource: string): string[] {
  return [...storyFileSource.matchAll(/^export (?:const|function) ([A-Za-z0-9_$]+)/gm)].flatMap(
    (match) => match[1] ?? []
  );
}

function kebabCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .toLowerCase();
}

const DOCUMENTATION_WORKFLOW_NAMES = ['docs-show', 'docs-show-story', 'docs-list'] as const;

// Not a liveness probe: the sandbox Storybook can crash on its own after
// test-run, which would fail the eval on infra rather than on the agent.
export function expectDevServerLeftRunning(): void {
  const { integration } = getEvalContext();
  if (integration !== 'plugin') {
    expect.fail(
      `expectDevServerLeftRunning is only for plugin (got integration=${integration}). Gate callers with test.skipIf(getEvalContext().integration !== 'plugin')`
    );
  }

  expect(
    findDevServerKillCommands(getShellCommands()),
    'The dev server must be left running for the user, never killed after verification'
  ).toEqual([]);
}

// The target must appear in the kill command itself so killing an unrelated
// process does not count; a kill of a PID captured in an earlier command escapes.
const KILL_COMMAND_PATTERN = /\b(?:kill|pkill|killall)\b|\bfuser\b[^;&|]*\s-[a-z]*k/i;
const DEV_SERVER_TARGET_PATTERN = /storybook|\.pid\b|\b6006\b/i;

export function findDevServerKillCommands(commands: string[]): string[] {
  return commands.filter(
    (command) => KILL_COMMAND_PATTERN.test(command) && DEV_SERVER_TARGET_PATTERN.test(command)
  );
}

// URLs the Codex in-app browser navigated to: `goto('<url>')` literals in
// successful node_repl `js` calls.
export function parseCodexBrowserNavigations(rawTranscript: string): string[] {
  return readCodexCompletedItems(rawTranscript).flatMap(getCodexItemNavigations);
}

function readCodexCompletedItems(rawTranscript: string): Record<string, unknown>[] {
  return rawTranscript.split('\n').flatMap((line) => {
    const event = parseJson(line);
    return isRecord(event) && event.type === 'item.completed' && isRecord(event.item)
      ? [event.item]
      : [];
  });
}

// A call that passes a variable to `goto` (a loop over URLs) counts the full
// URL literals in its code instead; a composed URL yields only its literal base.
function getCodexItemNavigations(item: Record<string, unknown>): string[] {
  if (item.server !== 'node_repl' || item.tool !== 'js' || !codexItemSucceeded(item)) {
    return [];
  }

  const code = isRecord(item.arguments) ? item.arguments.code : undefined;
  if (typeof code !== 'string') {
    return [];
  }

  const literalGotos = [...code.matchAll(/\.goto\(\s*(['"`])([^'"`]+)\1/g)].flatMap((match) =>
    match[2] === undefined ? [] : [match[2]]
  );
  if (!/\.goto\(\s*[A-Za-z_$]/.test(code)) {
    return literalGotos;
  }
  const urlLiterals = [...code.matchAll(/(['"`])(https?:\/\/[^'"`\s]+)\1/g)].flatMap((match) =>
    match[2] === undefined ? [] : [match[2]]
  );
  return [...new Set([...literalGotos, ...urlLiterals])];
}

function codexItemSucceeded(item: Record<string, unknown>): boolean {
  if (item.type === 'mcp_tool_call') {
    return item.status === 'completed' && (item.error === null || item.error === undefined);
  }
  if (item.type === 'command_execution') {
    return item.exit_code === 0;
  }
  return false;
}

function isLocalDevServerUrl(value: string): boolean {
  try {
    const { protocol, hostname } = new URL(value);
    return (
      (protocol === 'http:' || protocol === 'https:') &&
      ['localhost', '127.0.0.1', '0.0.0.0', '[::1]'].includes(hostname)
    );
  } catch {
    return false;
  }
}

// Story IDs must come from a discovery tool (stories-changed, or the
// stories-find-by-component fallback), never from file names or memory. A
// published review without a prior discovery call means the agent guessed
// its way to valid-looking IDs.
const STORY_DISCOVERY_WORKFLOW_NAMES = ['stories-changed', 'stories-find-by-component'];

export function expectStoryDiscoveryBeforeReview(): void {
  const calls = getStorybookWorkflowCalls();
  const firstDiscoveryIndex = calls.findIndex((call) =>
    STORY_DISCOVERY_WORKFLOW_NAMES.includes(call.name)
  );
  expect(
    firstDiscoveryIndex,
    `Expected a story-discovery call (${STORY_DISCOVERY_WORKFLOW_NAMES.join(' or ')}) before publishing the review`
  ).toBeGreaterThanOrEqual(0);

  const lastReviewIndex = calls.findLastIndex((call) => call.name === 'review-create');
  expect(lastReviewIndex, 'Expected review-create to be called').toBeGreaterThanOrEqual(0);
  expect(
    firstDiscoveryIndex,
    'Story discovery must happen before the review is published'
  ).toBeLessThan(lastReviewIndex);
}

export type WorkflowToolResult = {
  output: string;
  isError: boolean;
};

// The agent's own test output is often cut by `| tail` or `| grep`, so the
// verdict is a run of the harness's own. The transcript only has to show that
// the agent ran the tests and that its last run did not end red: a fix that was
// never re-run is unverified. There is no after-the-edit ordering check, because
// real passing flows run tests before the discovery step.
//
// `covering` requires one of the given substrings in the passing story ids.
// `cwd` is the Storybook project, for fixtures where that is not the root.
export async function expectStoryTestsRanAndPassed(options?: {
  covering?: string[];
  cwd?: string;
}): Promise<void> {
  expectWorkflowCalls(['test-run']);
  expect(
    getWorkflowToolResults('test-run').at(-1)?.output ?? '',
    "The agent's last test run must not report failing stories or unhandled errors"
  ).not.toMatch(/## (Failing Stories|Unhandled Errors)/);

  const result = await runStoryTestsInSandbox(options?.cwd);
  expect(
    result.isError,
    `The final test run must complete. Output: ${truncateForMessage(result.output)}`
  ).toBe(false);
  expect(result.output, 'The final test run must not report failing stories').not.toMatch(
    /## Failing Stories/
  );
  expect(result.output, 'The final test run must not report unhandled errors').not.toMatch(
    /## Unhandled Errors/
  );
  expect(
    result.output,
    `The final test run must report passing stories. Output: ${truncateForMessage(result.output)}`
  ).toMatch(/## Passing Stories/);

  const covering = options?.covering ?? [];
  if (covering.length > 0) {
    const passingStories =
      /## Passing Stories\n\n([\s\S]*?)(?:\n\n## |$)/.exec(result.output)?.[1] ?? '';
    expect(
      covering.some((substring) => passingStories.toLowerCase().includes(substring.toLowerCase())),
      `The final test run must cover the changed component (one of: ${covering.join(', ')}). Output: ${truncateForMessage(result.output)}`
    ).toBe(true);
  }
}

const sandboxStoryTestRuns = new Map<string, Promise<WorkflowToolResult>>();

// `isError` means stdout held no test-run document.
export function runStoryTestsInSandbox(cwd = '.'): Promise<WorkflowToolResult> {
  let run = sandboxStoryTestRuns.get(cwd);
  if (run === undefined) {
    run = withProjectVitestConfig(cwd, () => runStorybookTestRun(cwd));
    sandboxStoryTestRuns.set(cwd, run);
  }
  return run;
}

// The eval runner replaces vitest.config.ts with its own before EVAL.ts runs,
// so fixtures keep their Storybook test project in vitest.storybook.config.ts.
const STORYBOOK_VITEST_CONFIG = 'vitest.storybook.config.ts';

async function withProjectVitestConfig<T>(cwd: string, run: () => Promise<T>): Promise<T> {
  if (!existsSync(join(cwd, STORYBOOK_VITEST_CONFIG))) {
    return run();
  }
  const configPath = join(cwd, 'vitest.config.ts');
  const evalConfig = existsSync(configPath) ? readFileSync(configPath, 'utf8') : undefined;
  if (evalConfig?.includes(STORYBOOK_VITEST_CONFIG)) {
    return run();
  }

  writeFileSync(configPath, `export { default } from './${STORYBOOK_VITEST_CONFIG}';\n`);
  try {
    return await run();
  } finally {
    if (evalConfig === undefined) {
      rmSync(configPath);
    } else {
      writeFileSync(configPath, evalConfig);
    }
  }
}

// `--no-attach`: the dev server's Vitest restarts whenever vitest.config.ts
// changes, so a fresh local host is the only one that reads a settled config.
// The timeout leaves room in the experiment timeout, which the whole run shares,
// so a hanging run fails this assertion rather than the sandbox.
function runStorybookTestRun(cwd: string): Promise<WorkflowToolResult> {
  return new Promise((resolve) => {
    execFile(
      'npx',
      ['storybook', 'tools', '--no-attach', 'test', 'run', '--json'],
      {
        cwd,
        env: { ...process.env, STORYBOOK_DISABLE_TELEMETRY: '1' },
        maxBuffer: 256 * 1024 * 1024,
        timeout: 240_000,
      },
      (error, stdout, stderr) => {
        const report = renderTestRunJsonOutput(stdout);
        resolve(
          report === undefined
            ? { output: [error?.message, stdout, stderr].filter(Boolean).join('\n'), isError: true }
            : { output: report, isError: false }
        );
      }
    );
  });
}

// `storybook tools test run --json` prints the run's structured outcome
// instead of the markdown report. The raw JSON is unusable for the assertions
// here: the embedded axe reports list every rule id under passes/inapplicable,
// so a green run still "mentions" button-name. Render it to the section headings
// of the formatter (code/addons/vitest/src/node/toolset/format.ts), listing
// only what the assertions read: story ids and violation ids. Error and
// cancelled outcomes stay raw, as the markdown report has no heading for them.
function renderTestRunJsonOutput(output: string): string | undefined {
  // A `--json` run diverts every other stdout writer to stderr, so with `2>&1`
  // npm/logger lines surround the document: the pretty-printed block between a
  // `{` line and a `}` line.
  const json = /^\{$[\s\S]*^\}$/m.exec(output)?.[0];
  const data = json === undefined ? undefined : parseJson(json);
  if (!isRecord(data)) {
    return undefined;
  }

  if (data.status === 'no-stories') {
    return 'No stories found matching the provided input.';
  }

  return data.status === 'completed' && isRecord(data.result)
    ? renderCompletedTestRun(data.result, data.a11y !== false)
    : undefined;
}

function renderCompletedTestRun(result: Record<string, unknown>, a11y: boolean): string {
  const statuses = asRecords(result.componentTestStatuses);
  const storyIds = (value: string) =>
    statuses.filter((status) => status.value === value).map((status) => status.storyId);
  const a11yReports = a11y && isRecord(result.a11yReports) ? result.a11yReports : {};
  const violations = Object.entries(a11yReports).flatMap(([storyId, reports]) =>
    asRecords(reports).flatMap((report) =>
      asRecords(report.violations).map((violation) => `${storyId} - ${violation.id}`)
    )
  );
  const sections: [string, unknown[]][] = [
    ['## Passing Stories', storyIds('status-value:success')],
    ['## Failing Stories', storyIds('status-value:error')],
    ['## Accessibility Violations', violations],
    ['## Unhandled Errors', asRecords(result.unhandledErrors).map((error) => error.name)],
  ];

  return sections
    .filter(([, items]) => items.length > 0)
    .map(([heading, items]) => `${heading}\n\n- ${items.join('\n- ')}`)
    .join('\n\n');
}

function asRecords(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

// Chronological outputs of a Storybook workflow tool, across every path an
// agent can reach it: Claude MCP tool calls, Codex MCP tool calls, and
// `storybook tools` CLI invocations inside shell commands (plugin path).
export function getWorkflowToolResults(workflowName: string): WorkflowToolResult[] {
  return parseWorkflowToolResults(readFileSync(TRANSCRIPT_PATH, 'utf8'), workflowName);
}

export function parseWorkflowToolResults(
  rawTranscript: string,
  workflowName: string
): WorkflowToolResult[] {
  const results: WorkflowToolResult[] = [];
  const pendingClaudeToolUseIds = new Set<string>();

  for (const line of rawTranscript.split('\n')) {
    const event = parseJson(line);
    if (!isRecord(event)) {
      continue;
    }

    collectClaudeWorkflowToolResults(event, workflowName, pendingClaudeToolUseIds, results);
    collectCodexWorkflowToolResult(event, workflowName, results);
  }

  if (workflowName === 'test-run') {
    return results.map((result) => ({
      ...result,
      output: renderTestRunJsonOutput(result.output) ?? result.output,
    }));
  }

  return results;
}

// Claude Code raw transcripts pair tool_use blocks (assistant messages) with
// tool_result blocks (user messages) via tool_use_id.
function collectClaudeWorkflowToolResults(
  event: Record<string, unknown>,
  workflowName: string,
  pendingToolUseIds: Set<string>,
  results: WorkflowToolResult[]
): void {
  const message = event.message;
  if (!isRecord(message) || !Array.isArray(message.content)) {
    return;
  }

  for (const block of message.content) {
    if (!isRecord(block)) {
      continue;
    }

    if (
      block.type === 'tool_use' &&
      typeof block.id === 'string' &&
      isWorkflowToolUse(block, workflowName)
    ) {
      pendingToolUseIds.add(block.id);
      continue;
    }

    if (
      block.type === 'tool_result' &&
      typeof block.tool_use_id === 'string' &&
      pendingToolUseIds.has(block.tool_use_id)
    ) {
      pendingToolUseIds.delete(block.tool_use_id);
      results.push({
        output: extractToolResultText(block.content),
        isError: block.is_error === true,
      });
    }
  }
}

function isWorkflowToolUse(block: Record<string, unknown>, workflowName: string): boolean {
  if (typeof block.name !== 'string') {
    return false;
  }

  if (normalizeStorybookWorkflowName(block.name) === workflowName) {
    return true;
  }

  // Plugin path: the workflow call runs as a `storybook tools` CLI invocation
  // inside a shell tool call.
  const command = isRecord(block.input) ? block.input.command : undefined;
  if (typeof command !== 'string') {
    return false;
  }

  return shellCommandRunsWorkflow(command, workflowName);
}

function shellCommandRunsWorkflow(command: string, workflowName: string): boolean {
  return parseStorybookWorkflowShellCommands([command]).some((call) =>
    workflowCallMatchesName(call, workflowName)
  );
}

// Codex raw transcripts report completed MCP tool calls and shell commands as
// item.completed events carrying the result inline.
function collectCodexWorkflowToolResult(
  event: Record<string, unknown>,
  workflowName: string,
  results: WorkflowToolResult[]
): void {
  if (event.type !== 'item.completed' || !isRecord(event.item)) {
    return;
  }

  const item = event.item;

  if (
    item.type === 'mcp_tool_call' &&
    typeof item.tool === 'string' &&
    normalizeStorybookWorkflowName(item.tool) === workflowName
  ) {
    results.push({
      output: extractToolResultText(item.result),
      isError: item.status !== 'completed' || (item.error !== null && item.error !== undefined),
    });
    return;
  }

  if (
    item.type === 'command_execution' &&
    typeof item.command === 'string' &&
    shellCommandRunsWorkflow(item.command, workflowName)
  ) {
    results.push({
      output: typeof item.aggregated_output === 'string' ? item.aggregated_output : '',
      isError: typeof item.exit_code === 'number' && item.exit_code !== 0,
    });
  }
}

// Tool result payloads appear as plain strings, MCP content-block arrays
// ([{ type: 'text', text }]), or objects wrapping such an array.
function extractToolResultText(content: unknown): string {
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .flatMap((block) => (isRecord(block) && typeof block.text === 'string' ? [block.text] : []))
      .join('\n');
  }

  if (isRecord(content)) {
    return extractToolResultText(content.content);
  }

  return '';
}

function truncateForMessage(value: string): string {
  return value.length > 600 ? `${value.slice(0, 600)}…` : value;
}

export function expectDocumentationToolingCalled(): void {
  const documentationCalls = getStorybookWorkflowCalls().filter((call) =>
    (DOCUMENTATION_WORKFLOW_NAMES as readonly string[]).includes(call.name)
  );
  expect(
    documentationCalls.length,
    `Expected at least one documentation tool call (${DOCUMENTATION_WORKFLOW_NAMES.join(', ')})`
  ).toBeGreaterThan(0);
}

export function workflowCallIncludesStory(
  call: StorybookWorkflowCall,
  expected: StoryInputExpectation
): boolean {
  return getStoryInputs(call.input).some((input) => storyInputMatches(input, expected));
}

export function workflowCallUsesStoryId(call: StorybookWorkflowCall): boolean {
  return getStoryInputs(call.input).some((input) => typeof input.storyId === 'string');
}

// Claude Code invokes plugin skills through its Skill tool; Codex has no
// skill tool, so engaging a skill means reading its instruction file via a
// shell command. Gate call sites with
// `test.skipIf(getEvalContext().integration === 'mcp')` — no skills are
// installed on the MCP path, so MCP runs should report a skip instead of a
// false-pass.
export function expectSkillInvoked(skillName: string): void {
  const { agent } = getEvalContext();

  if (agent === 'claude-code') {
    // Match the skill argument exactly — a substring match would credit any
    // Skill invocation whose free-text args merely mention the word.
    const invoked = getTranscript().events.some(
      (event) =>
        event.type === 'tool_call' &&
        event.tool?.originalName === 'Skill' &&
        isRecord(event.tool.args) &&
        event.tool.args.skill === skillName
    );
    expect(invoked, `Expected the ${skillName} skill to be invoked via the Skill tool`).toBe(true);
    return;
  }

  // The codex plugin names its skill directories without the storybook-
  // prefix (.agents/skills/init, .agents/skills/stories, …).
  const codexSkillName = skillName.replace(/^storybook-/, '');
  const skillPathPattern = new RegExp(`skills/${codexSkillName}\\b`);
  const read = getShellCommands().some((command) => skillPathPattern.test(command));
  expect(
    read,
    `Expected the ${skillName} skill (skills/${codexSkillName}) to be read via a shell command`
  ).toBe(true);
}

// Lifecycle-outcome check for the upgrade evals: the given Storybook packages
// in package.json must end up at or above the minimum version — an
// under-upgrade (e.g. 9.x → 10.0.0 when the current release is 10.4.6) does
// not count. Compares the first x.y.z found in each spec numerically, so
// range prefixes (^, ~) don't matter.
export function expectStorybookDependenciesAtLeast(
  minInclusiveVersion: string,
  packageNames: string[],
  options?: {
    /**
     * Packages a correct upgrade may legitimately *remove* (e.g. Storybook 10
     * absorbs `@storybook/react`): only floor-checked when still present, so
     * a stale old copy fails but a clean removal passes.
     */
    ifPresent?: string[];
  }
): void {
  const packageJson = parseJson(readFileSync('package.json', 'utf8'));
  if (!isRecord(packageJson)) {
    expect.fail('Expected package.json to contain a JSON object');
  }

  const dependencies = {
    ...(isRecord(packageJson.dependencies) ? packageJson.dependencies : {}),
    ...(isRecord(packageJson.devDependencies) ? packageJson.devDependencies : {}),
  };

  const minimum = parseSemverTriple(minInclusiveVersion);
  if (minimum === undefined) {
    throw new Error(`Invalid minInclusiveVersion "${minInclusiveVersion}"`);
  }

  const expectAtLeastMinimum = (packageName: string, spec: string) => {
    const version = parseSemverTriple(spec);
    if (version === undefined) {
      expect.fail(`Could not parse a version from the ${packageName} spec "${spec}"`);
    }

    expect(
      compareSemverTriples(version, minimum) >= 0,
      `Expected ${packageName} to be upgraded to at least ${minInclusiveVersion}. Received: ${spec}`
    ).toBe(true);
  };

  for (const packageName of packageNames) {
    const spec = dependencies[packageName];
    if (typeof spec !== 'string') {
      expect.fail(
        `Expected a ${packageName} dependency in package.json. Received: ${String(spec)}`
      );
    }
    expectAtLeastMinimum(packageName, spec);
  }

  for (const packageName of options?.ifPresent ?? []) {
    const spec = dependencies[packageName];
    if (typeof spec === 'string') {
      expectAtLeastMinimum(packageName, spec);
    }
  }
}

function parseSemverTriple(spec: string): [number, number, number] | undefined {
  const match = /(\d+)\.(\d+)\.(\d+)/.exec(spec);
  if (match === null) {
    return undefined;
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function compareSemverTriples(left: [number, number, number], right: [number, number, number]) {
  for (let index = 0; index < 3; index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference !== 0) {
      return difference;
    }
  }
  return 0;
}

export function expectShellCommandMatching(pattern: RegExp): void {
  const commands = getShellCommands();
  expect(
    commands.some((command) => pattern.test(command)),
    `Expected a shell command matching ${pattern}. Received: ${truncateForMessage(
      JSON.stringify(commands)
    )}`
  ).toBe(true);
}

// Lifecycle-outcome check (storybookjs/mcp#324): after storybook-init or
// storybook-upgrade, the project's own `storybook` script must produce a
// bootable Storybook. Boots on a non-default port so an instance the agent
// left running on 6006 cannot mask a broken script.
export async function expectStorybookBoots(options?: { timeoutMs?: number }): Promise<void> {
  const port = 6017;
  const timeoutMs = options?.timeoutMs ?? 180_000;

  // --ci skips interactive prompts and does not open a browser; supported by
  // every Storybook major this helper is used against (9.x onwards).
  const child = spawn('npm', ['run', 'storybook', '--', '--port', String(port), '--ci'], {
    detached: true,
    env: { ...process.env, BROWSER: 'none', CI: '1' },
    stdio: 'ignore',
  });

  let spawnError: Error | undefined;
  child.on('error', (error) => {
    spawnError = error;
  });

  try {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (spawnError !== undefined) {
        expect.fail(`Failed to spawn npm run storybook: ${spawnError.message}`);
      }
      // exitCode stays null when the process dies from a signal, so check
      // signalCode too — otherwise a killed Storybook waits out the full
      // timeout instead of failing with its termination reason.
      if (child.exitCode !== null || child.signalCode !== null) {
        expect.fail(
          `npm run storybook exited (${
            child.signalCode !== null ? `signal ${child.signalCode}` : `code ${child.exitCode}`
          }) before serving`
        );
      }
      // /index.json is a real build artifact (the story index), so a dev
      // server that merely serves an error shell on / does not count as
      // booted.
      if (await isHttpReady(`http://127.0.0.1:${port}/index.json`)) {
        return;
      }
      await delay(1_000);
    }
    expect.fail(`Storybook did not respond on port ${port} within ${timeoutMs}ms`);
  } finally {
    killProcessTree(child);
  }
}

async function isHttpReady(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(2_000) });
    return response.ok;
  } catch {
    return false;
  }
}

function killProcessTree(child: ReturnType<typeof spawn>): void {
  if (child.pid === undefined) {
    return;
  }

  try {
    // Detached child leads its own process group; negative pid signals the
    // whole group so the Vite/Storybook workers die with it.
    process.kill(-child.pid, 'SIGTERM');
  } catch {
    child.kill('SIGTERM');
  }
}

// Soft-quality curation criterion: scored by the LLM judge rather than gated
// mechanically, because "meaningful grouping" and "useful rationale" are
// judgment calls.
export const DISPLAY_REVIEW_CURATION_CRITERION = [
  'The final review-create tool call publishes a well-curated review.',
  'It groups stories into 2 to 5 collections.',
  'No collection contains only a single story, unless there are too few stories to avoid it.',
  "Collections follow a meaningful layering, such as the changed component's visual states, its interaction behavior, or the surfaces that consume it — not arbitrary groupings.",
  'Each collection has a rationale that explains why those stories are worth reviewing for this change.',
  'The review title and description use plain language and avoid internal tooling jargon such as "collection" or "trigger".',
].join(' ');

export const A11Y_VISUAL_CHANGE_APPROVAL_CRITERION = [
  'The final response explains the remaining visual color contrast accessibility concern.',
  'It asks the user before changing visual or design colors.',
  'It offers two or three concrete options for fixing the contrast issue.',
  'It does not claim the visual contrast issue was already fixed.',
  'It distinguishes semantic accessibility issues that can be fixed directly from visual design changes that need user approval.',
].join(' ');

function readAgentContext(): AgentContext {
  return JSON.parse(readFileSync(AGENT_CONTEXT_PATH, 'utf8')) as AgentContext;
}

function expectValidDisplayReviewPayload(input: Record<string, unknown>): void {
  expectValidDisplayReviewCollections(input);

  expectNonEmptyArray(input.changedFiles, 'visual change review-create changedFiles');
  input.changedFiles.forEach((filePath, fileIndex) =>
    expectNonEmptyString(filePath, `visual change review-create changedFiles[${fileIndex}]`)
  );
}

function expectValidDisplayReviewCollections(input: Record<string, unknown>): void {
  expectNonEmptyString(input.title, 'review-create title');
  expectNonEmptyString(input.description, 'review-create description');
  expectNonEmptyArray(input.collections, 'review-create collections');

  for (const [index, collection] of input.collections.entries()) {
    const label = `review-create collection ${index}`;
    expectRecord(collection, label);
    expectNonEmptyString(collection.title, `${label} title`);
    expectNonEmptyString(collection.rationale, `${label} rationale`);
    expectNonEmptyArray(collection.storyIds, `${label} storyIds`);
    collection.storyIds.forEach((storyId, storyIndex) =>
      expectNonEmptyString(storyId, `${label} storyIds[${storyIndex}]`)
    );
  }
}

function expectNonEmptyString(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    expect.fail(`${label} must be a non-empty string. Received: ${JSON.stringify(value)}`);
  }
}

function expectNonEmptyArray(value: unknown, label: string): asserts value is unknown[] {
  if (!Array.isArray(value) || value.length === 0) {
    expect.fail(`${label} must be a non-empty array. Received: ${JSON.stringify(value)}`);
  }
}

function expectRecord(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (!isRecord(value)) {
    expect.fail(`${label} must be an object. Received: ${JSON.stringify(value)}`);
  }
}

const REVIEW_PAGE_URL_PATTERN = /[?&]path=\/review(?![\w-])/;

// Not tied to the link in the final response, so `localhost` versus
// `127.0.0.1` or a slash difference cannot fail the cell. Only navigations
// after the first successful review-create count: an earlier visit (for
// example to check that Storybook runs) does not qualify, while a re-publish
// updates the already open review page in place.
export function expectReviewOpenedInBrowser(): void {
  expectOpenedInBrowserAfter({
    workflowName: 'review-create',
    target: 'the review page',
    isTargetUrl: (url) => isLocalDevServerUrl(url) && REVIEW_PAGE_URL_PATTERN.test(url),
  });
}

function expectOpenedInBrowserAfter(options: {
  workflowName: string;
  target: string;
  isTargetUrl: (url: string) => boolean;
}): void {
  const { workflowName, target, isTargetUrl } = options;
  const steps = getBrowserStepsAroundWorkflowCalls(workflowName);
  const workflowCall = steps.indexOf(WORKFLOW_CALLED);
  if (workflowCall === -1) {
    expect.fail(
      `Expected a successful ${workflowName} call before the in-app browser check, but the transcript holds none.`
    );
  }
  const navigations = steps
    .slice(workflowCall + 1)
    .filter((step): step is string => typeof step === 'string');

  expect(
    navigations.length,
    `Expected the agent to open a URL in the in-app browser after ${workflowName} (a navigate / preview_start call, or a Codex goto), but the transcript holds no such browser navigation. Every experiment must install an in-app browser mock (writeClaudeInAppBrowserMock / writeCodexInAppBrowserMock).`
  ).toBeGreaterThan(0);
  expect(
    navigations.some(isTargetUrl),
    `Expected an in-app browser navigation to ${target} on the local dev server after ${workflowName}. Navigated to:\n${navigations.join('\n')}`
  ).toBe(true);
}

const WORKFLOW_CALLED = Symbol('workflow-called');

// In transcript order: each call of the workflow, and each URL the in-app
// browser navigated to. Claude's parsed transcript does not pair tool calls
// with their results, so there a failed call still counts.
function getBrowserStepsAroundWorkflowCalls(
  workflowName: string
): (string | typeof WORKFLOW_CALLED)[] {
  if (getEvalContext().agent === 'codex') {
    return readCodexCompletedItems(readFileSync(TRANSCRIPT_PATH, 'utf8')).flatMap<
      string | typeof WORKFLOW_CALLED
    >((item) => {
      const callsWorkflow =
        (item.type === 'mcp_tool_call' &&
          typeof item.tool === 'string' &&
          normalizeStorybookWorkflowName(item.tool) === workflowName) ||
        (item.type === 'command_execution' &&
          typeof item.command === 'string' &&
          shellCommandRunsWorkflow(item.command, workflowName));
      if (callsWorkflow) {
        return codexItemSucceeded(item) ? [WORKFLOW_CALLED] : [];
      }
      return getCodexItemNavigations(item);
    });
  }

  return getTranscript().events.flatMap<string | typeof WORKFLOW_CALLED>((event) => {
    const name = event.tool?.originalName;
    const args = event.tool?.args;
    if (event.type !== 'tool_call' || typeof name !== 'string' || !isRecord(args)) {
      return [];
    }
    if (
      normalizeStorybookWorkflowName(name) === workflowName ||
      (typeof args.command === 'string' && shellCommandRunsWorkflow(args.command, workflowName))
    ) {
      return [WORKFLOW_CALLED];
    }
    if (/^mcp__.+__(?:navigate|preview_start)$/.test(name)) {
      return typeof args.url === 'string' ? [args.url] : [];
    }
    if (/^mcp__.+__browser_batch$/.test(name) && Array.isArray(args.actions)) {
      return args.actions.flatMap((action) =>
        isRecord(action) &&
        typeof action.name === 'string' &&
        action.name.replace(/^mcp__.+?__/, '') === 'navigate' &&
        isRecord(action.input) &&
        typeof action.input.url === 'string'
          ? [action.input.url]
          : []
      );
    }
    return [];
  });
}

// Substance floor only (relaxed 2026-07-03 after run 28663662412, where
// correct reviews failed on presentation details): the user must get the
// review link in the final response, and not a second set of individual
// story links next to it — one set of links, never both. Presentation
// quality (headings, disclaimers, link placement) belongs in the
// judge-scored tier, not this gate.
function expectFinalResponseSharesReviewLink(): void {
  const finalMessage = getFinalAssistantMessage();
  if (finalMessage === undefined) {
    expect.fail('Expected a final assistant response');
  }

  expect(finalMessage, 'Final response must include the Storybook review page link').toMatch(
    REVIEW_PAGE_URL_PATTERN
  );
  expect(
    finalMessage,
    'Final response must not also include individual story preview links'
  ).not.toMatch(/(?:\?path=\/story\/|\/iframe\.html\?id=)/);
}

function getFinalAssistantMessage(): string | undefined {
  return getTranscript()
    .events.filter((event) => event.type === 'message' && event.role === 'assistant')
    .at(-1)?.content;
}

function getParsedMcpWorkflowCalls(): StorybookWorkflowCall[] {
  return getTranscript().events.flatMap((event) => {
    if (event.type !== 'tool_call' || typeof event.tool?.originalName !== 'string') {
      return [];
    }

    const name = normalizeStorybookWorkflowName(event.tool.originalName);
    if (name === undefined) {
      return [];
    }

    return [
      {
        name,
        input: isRecord(event.tool.args) ? event.tool.args : {},
        source: 'mcp' as const,
      },
    ];
  });
}

function getRawCodexMcpWorkflowCalls(): StorybookWorkflowCall[] {
  return readFileSync(TRANSCRIPT_PATH, 'utf8')
    .split('\n')
    .flatMap((line) => {
      if (line.trim().length === 0) {
        return [];
      }

      const event = parseJson(line);
      if (!isRecord(event) || !isRecord(event.item)) {
        return [];
      }

      // Codex emits each MCP call twice (item.started + item.completed);
      // counting both would double every call and produce a false-pass for
      // "called at least twice" assertions on a single real invocation.
      if (event.type !== 'item.completed') {
        return [];
      }

      const item = event.item;
      if (item.type !== 'mcp_tool_call' || typeof item.tool !== 'string') {
        return [];
      }

      const name = normalizeStorybookWorkflowName(item.tool);
      if (name === undefined) {
        return [];
      }

      return [
        {
          name,
          input: getRawMcpInput(item),
          source: 'mcp' as const,
        },
      ];
    });
}

function getRawMcpInput(item: Record<string, unknown>): Record<string, unknown> {
  return getNestedWorkflowInput(item) ?? {};
}

// Concatenation (parsed first, raw-only after) is order-safe in practice
// because each agent populates exactly one side: Claude transcripts parse
// fully (raw codex parsing matches nothing), while codex MCP calls come only
// from the raw pass (the upstream parser has no mcp_tool_call handling). If
// an agent ever split its calls across both sources, order-sensitive
// assertions like expectStoryDiscoveryBeforeReview would need interleaving by
// transcript position instead.
function mergeMcpWorkflowCalls(
  parsedCalls: StorybookWorkflowCall[],
  rawCalls: StorybookWorkflowCall[]
): StorybookWorkflowCall[] {
  return [
    ...parsedCalls,
    ...rawCalls.filter(
      (rawCall) => !parsedCalls.some((parsedCall) => isSameWorkflowCall(parsedCall, rawCall))
    ),
  ];
}

function getStoryInputs(input: Record<string, unknown>): Record<string, unknown>[] {
  const stories = input.stories;
  if (Array.isArray(stories)) {
    return stories.filter(isRecord);
  }

  return [input];
}

function storyInputMatches(
  input: Record<string, unknown>,
  expected: StoryInputExpectation
): boolean {
  if (
    expected.storyId !== undefined &&
    typeof input.storyId === 'string' &&
    input.storyId === expected.storyId
  ) {
    return true;
  }

  if (expected.absoluteStoryPath === undefined || expected.exportName === undefined) {
    return false;
  }

  if (
    typeof input.absoluteStoryPath === 'string' &&
    typeof input.exportName === 'string' &&
    input.exportName === expected.exportName &&
    pathsMatch(input.absoluteStoryPath, expected.absoluteStoryPath)
  ) {
    return true;
  }

  return false;
}

function pathsMatch(actual: string, expected: string): boolean {
  const normalizedActual = normalizePath(actual);
  const normalizedExpected = normalizePath(expected);
  return (
    normalizedActual === normalizedExpected || normalizedActual.endsWith(`/${normalizedExpected}`)
  );
}

function normalizePath(value: string): string {
  return value.replace(/\\/g, '/').replace(/^\.\//, '');
}
