import { readFileSync } from 'node:fs';

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

export function getToolCalls(): string[] {
	const parsedToolCalls = getTranscript().events.flatMap((event) => {
		if (event.type !== 'tool_call' || typeof event.tool?.originalName !== 'string') {
			return [];
		}

		return [event.tool.originalName];
	});

	return [...parsedToolCalls, ...getRawCodexMcpToolCalls()];
}

export function getStorybookWorkflowCalls(): StorybookWorkflowCall[] {
	if (cachedStorybookWorkflowCalls !== undefined) {
		return cachedStorybookWorkflowCalls;
	}

	const { integration } = getEvalContext();

	if (integration === 'plugin') {
		cachedStorybookWorkflowCalls = getShellCommands().flatMap(parseStorybookAiWorkflowCalls);
		return cachedStorybookWorkflowCalls;
	}

	const parsedCalls = getParsedMcpWorkflowCalls();
	const rawCalls = getRawCodexMcpWorkflowCalls();
	cachedStorybookWorkflowCalls = [
		...parsedCalls,
		...rawCalls.filter(
			(rawCall) => !parsedCalls.some((parsedCall) => isSameWorkflowCall(parsedCall, rawCall)),
		),
	];
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
	const displayReviewCalls = getWorkflowCalls('display-review');
	expect(displayReviewCalls.length, 'Expected display-review to be called').toBeGreaterThan(0);

	const displayReview = displayReviewCalls.at(-1);
	expect(displayReview, 'Expected a display-review call').toBeDefined();
	if (displayReview === undefined) {
		return;
	}

	expectValidDisplayReviewPayload(displayReview.input);
	expectFinalResponseEndsWithReviewSection();
}

function readAgentContext(): AgentContext {
	return JSON.parse(readFileSync(AGENT_CONTEXT_PATH, 'utf8')) as AgentContext;
}

function expectValidDisplayReviewPayload(input: Record<string, unknown>): void {
	expect(input.title, 'display-review needs a title').toEqual(expect.any(String));
	expect(
		String(input.title).trim().length,
		'display-review title must not be empty',
	).toBeGreaterThan(0);
	expect(input.description, 'display-review needs a description').toEqual(expect.any(String));
	expect(
		String(input.description).trim().length,
		'display-review description must not be empty',
	).toBeGreaterThan(0);

	const collections = input.collections;
	expect(Array.isArray(collections), 'display-review needs collections').toBe(true);
	if (!Array.isArray(collections)) {
		return;
	}
	expect(collections.length, 'display-review needs at least one collection').toBeGreaterThan(0);

	for (const [index, collection] of collections.entries()) {
		expect(isRecord(collection), `display-review collection ${index} must be an object`).toBe(true);
		if (!isRecord(collection)) {
			continue;
		}

		expect(collection.title, `display-review collection ${index} needs a title`).toEqual(
			expect.any(String),
		);
		expect(
			String(collection.title).trim().length,
			`display-review collection ${index} title must not be empty`,
		).toBeGreaterThan(0);
		expect(collection.rationale, `display-review collection ${index} needs a rationale`).toEqual(
			expect.any(String),
		);
		expect(
			String(collection.rationale).trim().length,
			`display-review collection ${index} rationale must not be empty`,
		).toBeGreaterThan(0);

		const storyIds = collection.storyIds;
		expect(Array.isArray(storyIds), `display-review collection ${index} needs storyIds`).toBe(true);
		if (!Array.isArray(storyIds)) {
			continue;
		}
		expect(
			storyIds.length,
			`display-review collection ${index} needs at least one story`,
		).toBeGreaterThan(0);
		expect(
			storyIds.every((storyId) => typeof storyId === 'string' && storyId.trim().length > 0),
			`display-review collection ${index} storyIds must be non-empty strings`,
		).toBe(true);
	}

	const changedFiles = input.changedFiles;
	expect(Array.isArray(changedFiles), 'visual change display-review needs changedFiles').toBe(true);
	if (!Array.isArray(changedFiles)) {
		return;
	}
	expect(
		changedFiles.length,
		'visual change display-review changedFiles must not be empty',
	).toBeGreaterThan(0);
	expect(
		changedFiles.every((filePath) => typeof filePath === 'string' && filePath.trim().length > 0),
		'visual change display-review changedFiles must be non-empty strings',
	).toBe(true);
}

function expectFinalResponseEndsWithReviewSection(): void {
	const finalMessage = getFinalAssistantMessage();
	expect(finalMessage, 'Expected a final assistant response').toBeDefined();
	if (finalMessage === undefined) {
		return;
	}

	const trimmed = finalMessage.trimEnd();
	const lines = trimmed.split('\n');
	const lastNonEmptyLine = [...lines]
		.reverse()
		.find((line) => line.trim().length > 0)
		?.trim();

	expect(lastNonEmptyLine, 'Final response must end with the Storybook review page link').toMatch(
		/^\u{1F449}\s+\[Open the Storybook review page\]\(.+\?path=\/review\/?\)$/u,
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

function getRawCodexMcpToolCalls(): string[] {
	return getRawCodexMcpWorkflowCalls().map((call) => call.name);
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

function parseStorybookAiWorkflowCalls(command: string): StorybookWorkflowCall[] {
	const nestedCommand = getNestedShellCommand(command);
	if (nestedCommand !== undefined) {
		return parseStorybookAiWorkflowCalls(nestedCommand);
	}

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

function parseStorybookAiInvocation(
	aiArgs: string[],
): { call: StorybookWorkflowCall; consumed: number } | undefined {
	const endIndex = aiArgs.findIndex(
		(token, index) =>
			SHELL_COMMAND_SEPARATORS.has(token) || (token === 'storybook' && aiArgs[index + 1] === 'ai'),
	);
	const segmentEnd = endIndex === -1 ? aiArgs.length : endIndex;
	const segment = aiArgs.slice(0, segmentEnd);
	const consumed = endIndex === -1 ? aiArgs.length : endIndex;

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
		Object.assign(input, value);
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
