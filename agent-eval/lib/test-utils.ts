import { existsSync, readFileSync } from 'node:fs';

import { loadTranscript } from '@vercel/agent-eval';
import type { Transcript } from '@vercel/agent-eval';
import { expect } from 'vitest';

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

export type StorybookWorkflowCall = {
	name: string;
	input: Record<string, unknown>;
	source: 'mcp' | 'storybook-ai';
};

const STORYBOOK_WORKFLOW_TOOL_NAMES = [
	'display-review',
	'get-changed-stories',
	'get-documentation',
	'get-documentation-for-story',
	'get-stories-by-component',
	'get-storybook-story-instructions',
	'list-all-documentation',
	'preview-stories',
	'run-story-tests',
] as const;

const SHELL_COMMAND_SEPARATORS = new Set(['&&', '||', ';', '|']);
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

export function expectDisplayReviewForVisualChange(): void {
	const displayReview = getWorkflowCalls('display-review').at(-1);
	if (displayReview === undefined) {
		expect.fail('Expected display-review to be called');
	}

	expectValidDisplayReviewPayload(displayReview.input);
	expectFinalResponseEndsWithReviewSection();
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

export const A11Y_VISUAL_CHANGE_APPROVAL_CRITERION = [
	'The final response explains the remaining visual color contrast accessibility concern.',
	'It asks the user before changing visual or design colors.',
	'It offers two or three concrete options for fixing the contrast issue.',
	'It does not claim the visual contrast issue was already fixed.',
	'It distinguishes semantic accessibility issues that can be fixed directly from visual design changes that need user approval.',
].join(' ');

export function parseStorybookWorkflowShellCommands(commands: string[]): StorybookWorkflowCall[] {
	return commands.flatMap(parsePluginWorkflowCalls);
}

function readAgentContext(): AgentContext {
	return JSON.parse(readFileSync(AGENT_CONTEXT_PATH, 'utf8')) as AgentContext;
}

function expectValidDisplayReviewPayload(input: Record<string, unknown>): void {
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

	expectNonEmptyArray(input.changedFiles, 'visual change display-review changedFiles');
	input.changedFiles.forEach((filePath, fileIndex) =>
		expectNonEmptyString(filePath, `visual change display-review changedFiles[${fileIndex}]`),
	);
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
	for (const key of ['arguments', 'input', 'args']) {
		const value = item[key];
		if (isRecord(value)) {
			return value;
		}
	}

	return {};
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

function parsePluginWorkflowCalls(command: string): StorybookWorkflowCall[] {
	const nestedCommand = getNestedShellCommand(command);
	if (nestedCommand !== undefined) {
		return parsePluginWorkflowCalls(nestedCommand);
	}

	return [
		...parseStorybookAiWorkflowCalls(command),
		...parseMcpCallScriptWorkflowCalls(command),
		...parseCurlWorkflowCalls(command),
	];
}

function parseStorybookAiWorkflowCalls(command: string): StorybookWorkflowCall[] {
	const tokens = tokenizeShellCommand(command);
	const calls: StorybookWorkflowCall[] = [];

	for (let index = 0; index < tokens.length - 1; index += 1) {
		if (tokens[index] !== 'storybook' || tokens[index + 1] !== 'ai') {
			continue;
		}

		const invocation = parseStorybookAiInvocation(tokens.slice(index + 2));
		if (invocation !== undefined) {
			calls.push(invocation.call);
			index += invocation.consumed + 1;
		}
	}

	return calls;
}

function parseMcpCallScriptWorkflowCalls(command: string): StorybookWorkflowCall[] {
	const tokens = tokenizeShellCommand(command);
	const calls: StorybookWorkflowCall[] = [];

	for (let index = 0; index < tokens.length - 1; index += 1) {
		const token = tokens[index];
		if (token === undefined || !token.endsWith('mcp-call.mjs')) {
			continue;
		}

		const name = normalizeStorybookWorkflowName(tokens[index + 1] ?? '');
		if (name === undefined) {
			continue;
		}

		const args = tokens.slice(index + 2);
		const endIndex = args.findIndex((arg) => SHELL_COMMAND_SEPARATORS.has(arg));
		const segment = endIndex === -1 ? args : args.slice(0, endIndex);
		calls.push({
			name,
			input: parseStorybookAiInput(segment),
			source: 'storybook-ai',
		});
	}

	return calls;
}

function parseCurlWorkflowCalls(command: string): StorybookWorkflowCall[] {
	const tokens = tokenizeShellCommand(command);
	if (!tokens.includes('curl')) {
		return [];
	}

	const calls: StorybookWorkflowCall[] = [];
	const input = getCurlWorkflowInput(tokens);

	for (const toolName of STORYBOOK_WORKFLOW_TOOL_NAMES) {
		if (!tokens.some((token) => token.includes(toolName))) {
			continue;
		}

		calls.push({
			name: toolName,
			input,
			source: 'storybook-ai',
		});
	}

	return calls;
}

function parseStorybookAiInvocation(
	aiArgs: string[],
): { call: StorybookWorkflowCall; consumed: number } | undefined {
	const endIndex = aiArgs.findIndex(
		(token, index) =>
			SHELL_COMMAND_SEPARATORS.has(token) || (token === 'storybook' && aiArgs[index + 1] === 'ai'),
	);
	const consumed = endIndex === -1 ? aiArgs.length : endIndex;
	const segment = aiArgs.slice(0, consumed);

	if (segment.includes('--help') || segment.includes('-h') || segment[0] === 'help') {
		return undefined;
	}

	const commandIndex = segment.findIndex(
		(token) => normalizeStorybookWorkflowName(token) !== undefined,
	);
	const commandToken = commandIndex === -1 ? undefined : segment[commandIndex];
	const name =
		commandToken === undefined ? undefined : normalizeStorybookWorkflowName(commandToken);

	if (name === undefined) {
		return undefined;
	}

	return {
		call: {
			name,
			input: parseStorybookAiInput(segment.slice(commandIndex + 1)),
			source: 'storybook-ai',
		},
		consumed,
	};
}

function getNestedShellCommand(command: string): string | undefined {
	const tokens = tokenizeShellCommand(command);
	for (let index = 0; index < tokens.length - 1; index += 1) {
		if (tokens[index] === '-c' || tokens[index] === '-lc') {
			return tokens[index + 1];
		}
	}

	return undefined;
}

function parseStorybookAiInput(tokens: string[]): Record<string, unknown> {
	const input: Record<string, unknown> = {};

	for (let index = 0; index < tokens.length; index += 1) {
		const token = tokens[index];
		if (token === undefined) {
			continue;
		}

		if (token === '--json') {
			const value = tokens[index + 1];
			if (value !== undefined && !value.startsWith('-')) {
				mergeJsonInput(input, parseCliValue(value), 'json');
				index += 1;
			} else {
				input.json = true;
			}
			continue;
		}

		if (token.startsWith('--')) {
			const [rawKey, inlineValue] = token.slice(2).split('=', 2);
			if (rawKey === undefined || rawKey.length === 0) {
				continue;
			}

			const key = kebabToCamel(rawKey);
			if (inlineValue !== undefined) {
				if (key === 'json') {
					mergeJsonInput(input, parseCliValue(inlineValue), 'json');
					continue;
				}
				input[key] = parseCliValue(inlineValue);
				continue;
			}

			const value = tokens[index + 1];
			if (value !== undefined && !value.startsWith('-')) {
				input[key] = parseCliValue(value);
				index += 1;
			} else {
				input[key] = true;
			}
			continue;
		}

		mergeJsonInput(input, parseCliValue(token), 'json');
	}

	return input;
}

function mergeJsonInput(input: Record<string, unknown>, value: unknown, fallbackKey: string): void {
	if (isRecord(value)) {
		Object.assign(input, unwrapWorkflowInput(value));
		return;
	}

	input[fallbackKey] = value;
}

function parseCliValue(value: string): unknown {
	try {
		return JSON.parse(value) as unknown;
	} catch {
		return value;
	}
}

function kebabToCamel(value: string): string {
	return value.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

function getCurlWorkflowInput(tokens: string[]): Record<string, unknown> {
	for (let index = 0; index < tokens.length; index += 1) {
		const token = tokens[index];
		if (token === undefined) {
			continue;
		}

		const inlineData = getInlineCurlData(token);
		if (inlineData !== undefined) {
			return parseWorkflowInputValue(inlineData);
		}

		if (['-d', '--data', '--data-raw', '--data-binary'].includes(token)) {
			const value = tokens[index + 1];
			if (value !== undefined) {
				return parseWorkflowInputValue(value);
			}
		}
	}

	return {};
}

function getInlineCurlData(token: string): string | undefined {
	for (const prefix of ['--data=', '--data-raw=', '--data-binary=']) {
		if (token.startsWith(prefix)) {
			return token.slice(prefix.length);
		}
	}

	return undefined;
}

function parseWorkflowInputValue(value: string): Record<string, unknown> {
	const parsed = parseCliValue(value);
	return isRecord(parsed) ? unwrapWorkflowInput(parsed) : {};
}

function unwrapWorkflowInput(value: Record<string, unknown>): Record<string, unknown> {
	for (const key of ['arguments', 'input', 'args']) {
		const nested = value[key];
		if (isRecord(nested)) {
			return nested;
		}
	}

	const params = value.params;
	if (isRecord(params)) {
		for (const key of ['arguments', 'input', 'args']) {
			const nested = params[key];
			if (isRecord(nested)) {
				return nested;
			}
		}
	}

	return value;
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

		if (escaping) {
			token += char;
			escaping = false;
			continue;
		}

		if (char === '\\') {
			escaping = true;
			continue;
		}

		if (quote !== undefined) {
			if (char === quote) {
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

function normalizeStorybookWorkflowName(name: string): string | undefined {
	return STORYBOOK_WORKFLOW_TOOL_NAMES.find(
		(toolName) =>
			name === toolName ||
			name.endsWith(`__${toolName}`) ||
			name.endsWith(`.${toolName}`) ||
			name.endsWith(`/${toolName}`),
	);
}

function isSameWorkflowCall(first: StorybookWorkflowCall, second: StorybookWorkflowCall): boolean {
	return first.name === second.name && JSON.stringify(first.input) === JSON.stringify(second.input);
}

function dedupeWorkflowCalls(calls: StorybookWorkflowCall[]): StorybookWorkflowCall[] {
	return calls.filter(
		(call, index) => calls.findIndex((candidate) => isSameWorkflowCall(candidate, call)) === index,
	);
}

function parseJson(value: string): unknown {
	try {
		return JSON.parse(value) as unknown;
	} catch {
		return undefined;
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}
