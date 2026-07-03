import { spawn } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

import { loadTranscript } from '@vercel/agent-eval';
import type { Transcript } from '@vercel/agent-eval';
import { expect } from 'vitest';

import {
	getNestedWorkflowInput,
	isRecord,
	isSameWorkflowCall,
	normalizeStorybookWorkflowName,
	parseJson,
	parseStorybookWorkflowShellCommands,
} from './shell-parse.ts';
import type { StorybookWorkflowCall } from './shell-parse.ts';

export { isRecord, parseJson, parseStorybookWorkflowShellCommands };
export type { StorybookWorkflowCall };

const AGENT_CONTEXT_PATH = '__agent_eval__/agent.json';
const RESULTS_PATH = '__agent_eval__/results.json';
const TRANSCRIPT_PATH = '__agent_eval__/transcript.txt';

type AgentContext = {
	agent?: unknown;
	integration?: unknown;
	review?: unknown;
};

type EvalContext = {
	agent: string;
	integration: 'mcp' | 'plugin';
	/** Whether the sandbox Storybook runs with the `experimentalReview` feature flag on. */
	review: boolean;
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
			'Expected ' + AGENT_CONTEXT_PATH + ' to contain an agent name. Received: ' + String(agent),
		);
	}

	if (integration !== 'mcp' && integration !== 'plugin') {
		throw new Error(
			'Expected ' +
				AGENT_CONTEXT_PATH +
				' to contain an integration. Received: ' +
				String(integration),
		);
	}

	return { agent, integration, review: agentContext.review === true };
}

// Review mode of this run: EVAL_REVIEW=1 (the ci:review PR label) enables the
// opt-in `experimentalReview` feature flag in the sandbox Storybook. EVAL.ts
// files branch on this — with review on, visual work must end in a published
// display-review; with review off (the default), display-review is not even
// registered and the workflow ends in preview-stories links.
export function isReviewEnabled(): boolean {
	return getEvalContext().review;
}

export function getTranscript(agent = getEvalContext().agent): Transcript {
	const raw = readFileSync(TRANSCRIPT_PATH, 'utf8');
	return loadTranscript(raw, agent);
}

export function getShellCommands(): string[] {
	const results = JSON.parse(readFileSync(RESULTS_PATH, 'utf8')) as AgentEvalResults;
	return (
		results.o11y?.shellCommands?.flatMap((shellCommand) =>
			typeof shellCommand.command === 'string' ? [shellCommand.command] : [],
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
	return getStorybookWorkflowCalls().filter((call) => call.name === name);
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
			substring,
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
	const displayReview = getWorkflowCalls('display-review').at(-1);
	if (displayReview === undefined) {
		expect.fail('Expected display-review to be called');
	}

	expectValidDisplayReviewPayload(displayReview.input);
	expectFinalResponseSharesReviewLink();
}

// Review-off counterpart of expectDisplayReviewForVisualChange (review is
// opt-in via the `experimentalReview` flag, so this is the default path):
// display-review is not registered, so visual work ends in preview-stories
// and the final response shares the preview URLs, per the legacy dev
// instructions ("Always include every returned preview URL...") and the
// review-off story instructions. `covering` requires each substring to appear
// in some preview-stories story input (storyId, exportName, or story path);
// `coveringAnyOf` requires at least one of the substrings instead.
export function expectPreviewStoriesWithFinalLinks(options?: {
	covering?: string[];
	coveringAnyOf?: string[];
}): void {
	expectWorkflowCalls(['preview-stories']);

	const storyInputs = getWorkflowCalls('preview-stories').flatMap((call) =>
		getStoryInputs(call.input),
	);
	const inputCovers = (substring: string) =>
		storyInputs.some((input) =>
			JSON.stringify(input).toLowerCase().includes(substring.toLowerCase()),
		);

	for (const substring of options?.covering ?? []) {
		expect(
			inputCovers(substring),
			`Expected a preview-stories story input covering "${substring}". Received: ${JSON.stringify(storyInputs)}`,
		).toBe(true);
	}

	const anyOf = options?.coveringAnyOf ?? [];
	if (anyOf.length > 0) {
		expect(
			anyOf.some(inputCovers),
			`Expected a preview-stories story input covering one of ${JSON.stringify(anyOf)}. Received: ${JSON.stringify(storyInputs)}`,
		).toBe(true);
	}

	const finalMessage = getFinalAssistantMessage() ?? '';
	expect(finalMessage, 'Final response must include a story preview link').toMatch(
		/(?:\?path=\/story\/|\/iframe\.html\?id=)/,
	);
	expect(
		finalMessage,
		'Final response must not link to the Storybook review page when review is disabled',
	).not.toMatch(/[?&]path=\/review\//);
}

// Trigger correctness (Agentic Review Eval instructions §6a.1): a pure
// non-visual refactor must NOT publish a review, and the final response must
// not pretend there is one.
export function expectNoDisplayReview(): void {
	const displayReviewCalls = getWorkflowCalls('display-review');
	expect(
		displayReviewCalls.length,
		`Expected display-review NOT to be called for a non-visual change. Received payloads: ${JSON.stringify(
			displayReviewCalls.map((call) => call.input),
		)}`,
	).toBe(0);

	expect(
		getFinalAssistantMessage() ?? '',
		'Final response must not link to the Storybook review page for a non-visual change',
	).not.toMatch(/[?&]path=\/review\//);
}

// Browse request (Agentic Review Eval instructions §7 branch 4): the review is
// resolved from the live story index, so the payload must pass an empty
// changedFiles array — no code changed. (changedFiles is required in the
// schema; `[]` is the explicit browse-mode value.)
export function expectDisplayReviewForBrowseRequest(): void {
	const displayReview = getWorkflowCalls('display-review').at(-1);
	if (displayReview === undefined) {
		expect.fail('Expected display-review to be called');
	}

	expectValidDisplayReviewCollections(displayReview.input);
	expect(
		displayReview.input.changedFiles,
		'Browse-request display-review must pass changedFiles: []',
	).toEqual([]);
	expectFinalResponseSharesReviewLink();
}

// Hard-floor completeness (Agentic Review Eval instructions §6a.2): every story
// exported from the story files written during the run must appear in the
// published review. Assumes the template starts without story files, so every
// story file on disk was created by the agent.
export function expectAllStoryExportsInDisplayReview(): void {
	const displayReview = getWorkflowCalls('display-review').at(-1);
	if (displayReview === undefined) {
		expect.fail('Expected display-review to be called');
	}

	const payloadStoryIds = getDisplayReviewStoryIds(displayReview.input);
	const storyFiles = findStoryFiles('.');
	expect(storyFiles.length, 'Expected the agent to write at least one story file').toBeGreaterThan(
		0,
	);

	for (const storyFile of storyFiles) {
		for (const exportName of getStoryExportNames(readFileSync(storyFile, 'utf8'))) {
			const suffix = `--${kebabCase(exportName)}`;
			expect(
				payloadStoryIds.some((storyId) => storyId.endsWith(suffix)),
				`Expected story "${exportName}" from ${storyFile} in the display-review payload. Received storyIds: ${JSON.stringify(payloadStoryIds)}`,
			).toBe(true);
		}
	}
}

// Targeted completeness floor: the stories the task is about must appear in
// the published review. Deliberately weaker than the §6a.2 "every story" rule
// (pending guidance on interaction stories), so it is safe to gate on.
export function expectStoryIdsInDisplayReview(idSubstrings: string[]): void {
	const displayReview = getWorkflowCalls('display-review').at(-1);
	if (displayReview === undefined) {
		expect.fail('Expected display-review to be called');
	}

	const storyIds = getDisplayReviewStoryIds(displayReview.input);
	for (const substring of idSubstrings) {
		expect(
			storyIds.some((storyId) => storyId.includes(substring)),
			`Expected a storyId containing "${substring}" in the display-review payload. Received storyIds: ${JSON.stringify(storyIds)}`,
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
			: [],
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
		(match) => match[1] ?? [],
	);
}

function kebabCase(value: string): string {
	return value
		.replace(/([a-z0-9])([A-Z])/g, '$1-$2')
		.replace(/[^a-zA-Z0-9]+/g, '-')
		.replace(/(^-|-$)/g, '')
		.toLowerCase();
}

const DOCUMENTATION_WORKFLOW_NAMES = [
	'get-documentation',
	'get-documentation-for-story',
	'list-all-documentation',
] as const;

const LAUNCH_CONFIG_PATH = '.claude/launch.json';

function usesClaudePreviewTooling(): boolean {
	const { agent, integration } = getEvalContext();
	return agent === 'claude-code' && integration === 'plugin';
}

export function expectValidStorybookLaunchConfig(): void {
	if (!usesClaudePreviewTooling()) {
		return;
	}

	if (!existsSync(LAUNCH_CONFIG_PATH)) {
		expect.fail(`Expected ${LAUNCH_CONFIG_PATH} to be written`);
	}

	const launchConfig = parseJson(readFileSync(LAUNCH_CONFIG_PATH, 'utf8'));
	expectRecord(launchConfig, LAUNCH_CONFIG_PATH);
	expectNonEmptyArray(launchConfig.configurations, `${LAUNCH_CONFIG_PATH} configurations`);

	const storybookEntry = launchConfig.configurations.find(
		(configuration) =>
			isRecord(configuration) &&
			Array.isArray(configuration.runtimeArgs) &&
			configuration.runtimeArgs.includes('storybook'),
	);
	expectRecord(storybookEntry, `${LAUNCH_CONFIG_PATH} configuration running the storybook script`);

	expect(storybookEntry.port, 'Storybook launch entry must use port 6006').toBe(6006);
	expect(storybookEntry.autoPort, 'Storybook launch entry must set autoPort: true').toBe(true);

	const packageJson = parseJson(readFileSync('package.json', 'utf8'));
	const scripts = isRecord(packageJson) && isRecord(packageJson.scripts) ? packageJson.scripts : {};
	expect(
		typeof scripts.storybook,
		'Launch entry references the storybook script, so package.json must define it',
	).toBe('string');
}

export function expectPreviewBrowserStarted(): void {
	if (!usesClaudePreviewTooling()) {
		return;
	}

	const started = getTranscript().events.some(
		(event) =>
			event.type === 'tool_call' &&
			typeof event.tool?.originalName === 'string' &&
			/__preview_start$/.test(event.tool.originalName),
	);
	expect(
		started,
		'Expected the Claude preview browser to be opened via the preview_start tool',
	).toBe(true);
}

// The story-ID mapping chain in the dev instructions: story IDs must come from
// a discovery tool (get-changed-stories, or the get-stories-by-component
// fallback), never from file names or memory. A published review without a
// prior discovery call means the agent guessed its way to valid-looking IDs.
const STORY_DISCOVERY_WORKFLOW_NAMES = ['get-changed-stories', 'get-stories-by-component'];

export function expectStoryDiscoveryBeforeReview(): void {
	const calls = getStorybookWorkflowCalls();
	const firstDiscoveryIndex = calls.findIndex((call) =>
		STORY_DISCOVERY_WORKFLOW_NAMES.includes(call.name),
	);
	expect(
		firstDiscoveryIndex,
		`Expected a story-discovery call (${STORY_DISCOVERY_WORKFLOW_NAMES.join(' or ')}) before publishing the review`,
	).toBeGreaterThanOrEqual(0);

	const lastReviewIndex = calls.findLastIndex((call) => call.name === 'display-review');
	expect(lastReviewIndex, 'Expected display-review to be called').toBeGreaterThanOrEqual(0);
	expect(
		firstDiscoveryIndex,
		'Story discovery must happen before the review is published',
	).toBeLessThan(lastReviewIndex);
}

export type WorkflowToolResult = {
	output: string;
	isError: boolean;
};

// Validation Workflow (test-instructions.md): "After each component or story
// change, run run-story-tests" and "Fix failing tests before reporting
// success." The section headers come from the run-story-tests result
// formatter in packages/addon-mcp (## Passing Stories / ## Failing Stories /
// ## Unhandled Errors) and appear verbatim in the MCP tool result and in the
// `storybook ai run-story-tests` CLI output.
//
// `covering` pins the final green run to the change under test: at least one
// of the given substrings must appear in its story ids. Where the covered
// stories are created by the change (801/802/804/812/813) or start from a
// seeded failure (810/811), a green covering run is only possible after the
// change, so this also proves ordering. Where the covered stories pre-exist
// and pass (803, 808), it is a component-coverage floor only — a stricter
// after-the-edit ordering check is deliberately not encoded, because real
// passing flows legitimately run tests before the discovery step.
export function expectStoryTestsRanAndPassed(options?: { covering?: string[] }): void {
	expectWorkflowCalls(['run-story-tests']);

	const results = getWorkflowToolResults('run-story-tests');
	expect(
		results.length,
		'Expected at least one run-story-tests result in the transcript',
	).toBeGreaterThan(0);

	const lastResult = results[results.length - 1];
	if (lastResult === undefined) {
		expect.fail('Expected a final run-story-tests result');
	}

	expect(
		lastResult.isError,
		`Final run-story-tests call must succeed. Output: ${truncateForMessage(lastResult.output)}`,
	).toBe(false);
	expect(
		lastResult.output,
		'Final run-story-tests result must not report failing stories',
	).not.toMatch(/## Failing Stories/);
	expect(
		lastResult.output,
		'Final run-story-tests result must not report unhandled errors',
	).not.toMatch(/## Unhandled Errors/);
	expect(
		lastResult.output,
		`Final run-story-tests result must report passing stories. Output: ${truncateForMessage(lastResult.output)}`,
	).toMatch(/## Passing Stories/);

	const covering = options?.covering ?? [];
	if (covering.length > 0) {
		expect(
			covering.some((substring) =>
				lastResult.output.toLowerCase().includes(substring.toLowerCase()),
			),
			`Final run-story-tests result must cover the changed component (one of: ${covering.join(', ')}). Output: ${truncateForMessage(lastResult.output)}`,
		).toBe(true);
	}
}

// Chronological outputs of a Storybook workflow tool, across every path an
// agent can reach it: Claude MCP tool calls, Codex MCP tool calls, and
// `storybook ai <tool>` CLI invocations inside shell commands (plugin path).
export function getWorkflowToolResults(workflowName: string): WorkflowToolResult[] {
	return parseWorkflowToolResults(readFileSync(TRANSCRIPT_PATH, 'utf8'), workflowName);
}

export function parseWorkflowToolResults(
	rawTranscript: string,
	workflowName: string,
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

	return results;
}

// Claude Code raw transcripts pair tool_use blocks (assistant messages) with
// tool_result blocks (user messages) via tool_use_id.
function collectClaudeWorkflowToolResults(
	event: Record<string, unknown>,
	workflowName: string,
	pendingToolUseIds: Set<string>,
	results: WorkflowToolResult[],
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

	// Plugin path: the workflow call runs as a `storybook ai` CLI invocation
	// inside a shell tool call.
	const command = isRecord(block.input) ? block.input.command : undefined;
	if (typeof command !== 'string') {
		return false;
	}

	return parseStorybookWorkflowShellCommands([command]).some((call) => call.name === workflowName);
}

// Codex raw transcripts report completed MCP tool calls and shell commands as
// item.completed events carrying the result inline.
function collectCodexWorkflowToolResult(
	event: Record<string, unknown>,
	workflowName: string,
	results: WorkflowToolResult[],
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
		parseStorybookWorkflowShellCommands([item.command]).some((call) => call.name === workflowName)
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
		(DOCUMENTATION_WORKFLOW_NAMES as readonly string[]).includes(call.name),
	);
	expect(
		documentationCalls.length,
		`Expected at least one documentation tool call (${DOCUMENTATION_WORKFLOW_NAMES.join(', ')})`,
	).toBeGreaterThan(0);
}

export function workflowCallIncludesStory(
	call: StorybookWorkflowCall,
	expected: StoryInputExpectation,
): boolean {
	return getStoryInputs(call.input).some((input) => storyInputMatches(input, expected));
}

export function workflowCallUsesStoryId(call: StorybookWorkflowCall): boolean {
	return getStoryInputs(call.input).some((input) => typeof input.storyId === 'string');
}

// Claude Code invokes plugin skills through its Skill tool, so the transcript
// records which skill fired. Codex has no skill tool — engaging a skill means
// reading its instruction file, which shows up as a shell command touching
// the skill's directory. Only meaningful on the plugin integration (no skills
// are installed on the MCP path) — gate call sites with
// `test.skipIf(getEvalContext().integration === 'mcp')` so MCP runs report a
// skip instead of a vacuous pass.
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
				event.tool.args.skill === skillName,
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
		`Expected the ${skillName} skill (skills/${codexSkillName}) to be read via a shell command`,
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
	},
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
			`Expected ${packageName} to be upgraded to at least ${minInclusiveVersion}. Received: ${spec}`,
		).toBe(true);
	};

	for (const packageName of packageNames) {
		const spec = dependencies[packageName];
		if (typeof spec !== 'string') {
			expect.fail(
				`Expected a ${packageName} dependency in package.json. Received: ${String(spec)}`,
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
			JSON.stringify(commands),
		)}`,
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
					}) before serving`,
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

// Soft-quality curation model from the Agentic Review Eval instructions (§5/§6b):
// scored by the LLM judge rather than gated mechanically, because "meaningful
// grouping" and "useful rationale" are judgment calls.
export const DISPLAY_REVIEW_CURATION_CRITERION = [
	'The final display-review tool call publishes a well-curated review.',
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

	expectNonEmptyArray(input.changedFiles, 'visual change display-review changedFiles');
	input.changedFiles.forEach((filePath, fileIndex) =>
		expectNonEmptyString(filePath, `visual change display-review changedFiles[${fileIndex}]`),
	);
}

function expectValidDisplayReviewCollections(input: Record<string, unknown>): void {
	expectNonEmptyString(input.title, 'display-review title');
	expectNonEmptyString(input.description, 'display-review description');
	expectNonEmptyArray(input.collections, 'display-review collections');

	for (const [index, collection] of input.collections.entries()) {
		const label = `display-review collection ${index}`;
		expectRecord(collection, label);
		expectNonEmptyString(collection.title, `${label} title`);
		expectNonEmptyString(collection.rationale, `${label} rationale`);
		expectNonEmptyArray(collection.storyIds, `${label} storyIds`);
		collection.storyIds.forEach((storyId, storyIndex) =>
			expectNonEmptyString(storyId, `${label} storyIds[${storyIndex}]`),
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

// Substance floor only (relaxed 2026-07-03 after run 28663662412): the user
// must get the review link in the final response, and not a second set of
// individual story links next to it ("one set of links, never both"). Where
// the link sits, the section heading, and the AI-curated disclaimer are the
// guidance's example presentation — cc-mcp runs delivered a correct review
// but were failed for a missing heading (806) or trailing prose after the
// link (808). Presentation quality belongs in the judge-scored tier, not the
// gate.
function expectFinalResponseSharesReviewLink(): void {
	const finalMessage = getFinalAssistantMessage();
	if (finalMessage === undefined) {
		expect.fail('Expected a final assistant response');
	}

	expect(finalMessage, 'Final response must include the Storybook review page link').toMatch(
		/[?&]path=\/review\/?/,
	);
	expect(
		finalMessage,
		'Final response must not also include individual story preview links',
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
			// counting both would double every call and let "called at least
			// twice" assertions pass vacuously on a single real invocation.
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
	rawCalls: StorybookWorkflowCall[],
): StorybookWorkflowCall[] {
	return [
		...parsedCalls,
		...rawCalls.filter(
			(rawCall) => !parsedCalls.some((parsedCall) => isSameWorkflowCall(parsedCall, rawCall)),
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
	expected: StoryInputExpectation,
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
