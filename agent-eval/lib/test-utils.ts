import { readFileSync } from 'node:fs';

import { loadTranscript } from '@vercel/agent-eval';
import type { Transcript } from '@vercel/agent-eval';

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
	const { integration } = getEvalContext();

	if (integration === 'plugin') {
		return getShellCommands().flatMap(parseStorybookAiWorkflowCalls);
	}

	const parsedCalls = getParsedMcpWorkflowCalls();
	const rawCalls = getRawCodexMcpWorkflowCalls();
	return [
		...parsedCalls,
		...rawCalls.filter(
			(rawCall) => !parsedCalls.some((parsedCall) => isSameWorkflowCall(parsedCall, rawCall)),
		),
	];
}

function readAgentContext(): AgentContext {
	return JSON.parse(readFileSync(AGENT_CONTEXT_PATH, 'utf8')) as AgentContext;
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
	const storybookIndex = tokens.findIndex(
		(token, index) => token === 'storybook' && tokens[index + 1] === 'ai',
	);

	if (storybookIndex === -1) {
		return [];
	}

	const aiArgs = tokens.slice(storybookIndex + 2);
	if (aiArgs.includes('--help') || aiArgs.includes('-h') || aiArgs[0] === 'help') {
		return [];
	}

	const commandIndex = aiArgs.findIndex(
		(token) => normalizeStorybookWorkflowName(token) !== undefined,
	);
	if (commandIndex === -1) {
		return [];
	}

	const commandToken = aiArgs[commandIndex];
	if (commandToken === undefined) {
		return [];
	}

	const name = normalizeStorybookWorkflowName(commandToken);
	if (name === undefined) {
		return [];
	}

	return [
		{
			name,
			input: parseStorybookAiInput(aiArgs.slice(commandIndex + 1)),
			source: 'storybook-ai',
		},
	];
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

	for (const char of command) {
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

		if (/\s/.test(char)) {
			if (token.length > 0) {
				tokens.push(token);
				token = '';
			}
			continue;
		}

		token += char;
	}

	if (token.length > 0) {
		tokens.push(token);
	}

	return tokens;
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
