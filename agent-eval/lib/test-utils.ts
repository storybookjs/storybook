import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

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

export { parseStorybookWorkflowShellCommands };
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
	integration: 'mcp' | 'plugin';
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

export function expectDisplayReviewForVisualChange(): void {
	const displayReview = getWorkflowCalls('display-review').at(-1);
	if (displayReview === undefined) {
		expect.fail('Expected display-review to be called');
	}

	expectValidDisplayReviewPayload(displayReview.input);
	expectFinalResponseEndsWithReviewSection();
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
	expectFinalResponseEndsWithReviewSection();
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

function expectFinalResponseEndsWithReviewSection(): void {
	const finalMessage = getFinalAssistantMessage();
	if (finalMessage === undefined) {
		expect.fail('Expected a final assistant response');
	}

	const trimmed = finalMessage.trimEnd();
	const lines = trimmed.split('\n');
	const lastNonEmptyLine = lines.findLast((line) => line.trim().length > 0)?.trim();

	expect(lastNonEmptyLine, 'Final response must end with the Storybook review page link').toMatch(
		/^(?:\S+\s+)?\[[^\]\n]+\]\([^)\n]*[?&]path=\/review\/?[^)\n]*\)$/u,
	);
	expect(
		lines.some((line) => /^##\s+.*Review your changes\s*$/.test(line.trim())),
		'Final response must include a dedicated review heading',
	).toBe(true);
	expect(
		trimmed,
		'Final response must explain the review is AI-curated and may be inaccurate',
	).toMatch(/AI[-\s]?curated/i);
	expect(
		trimmed,
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
