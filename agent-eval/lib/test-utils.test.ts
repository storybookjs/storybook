import { describe, expect, test } from 'vitest';
import {
	parseStorybookWorkflowShellCommands,
	parseWorkflowToolResults,
	workflowCallIncludesStory,
	workflowCallUsesStoryId,
} from './test-utils.ts';

describe('parseStorybookWorkflowShellCommands', () => {
	test('preserves repeated workflow calls across separate plugin commands', () => {
		const command =
			'storybook ai run-story-tests --json \'{"stories":[{"storyId":"example-button--primary"}]}\'';

		const calls = parseStorybookWorkflowShellCommands([command, command]);

		expect(calls).toHaveLength(2);
		expect(calls.map((call) => call.name)).toEqual(['run-story-tests', 'run-story-tests']);
		expect(calls.every(workflowCallUsesStoryId)).toBe(true);
	});

	test('preserves repeated workflow calls chained in one plugin command', () => {
		const command =
			'storybook ai run-story-tests --json \'{"stories":[{"storyId":"example-button--primary"}]}\' && storybook ai run-story-tests --json \'{"stories":[{"storyId":"example-button--primary"}]}\'';

		const calls = parseStorybookWorkflowShellCommands([command]);

		expect(calls).toHaveLength(2);
		expect(calls.map((call) => call.name)).toEqual(['run-story-tests', 'run-story-tests']);
		expect(calls.every(workflowCallUsesStoryId)).toBe(true);
	});

	test('parses storybook ai path and export JSON input', () => {
		const calls = parseStorybookWorkflowShellCommands([
			'storybook ai preview-stories --json \'{"stories":[{"absoluteStoryPath":"stories/Button.stories.tsx","exportName":"Primary"}]}\'',
		]);

		expect(calls).toHaveLength(1);
		expect(calls[0]?.name).toBe('preview-stories');
		expect(
			calls.some((call) =>
				workflowCallIncludesStory(call, {
					absoluteStoryPath: 'stories/Button.stories.tsx',
					exportName: 'Primary',
				}),
			),
		).toBe(true);
	});

	test('parses inline storybook ai JSON input', () => {
		const calls = parseStorybookWorkflowShellCommands([
			'storybook ai run-story-tests --json=\'{"stories":[{"storyId":"example-button--primary"}],"a11y":false}\'',
		]);

		expect(calls).toHaveLength(1);
		expect(calls[0]?.name).toBe('run-story-tests');
		expect(calls[0]?.input.a11y).toBe(false);
		expect(
			calls.some((call) => workflowCallIncludesStory(call, { storyId: 'example-button--primary' })),
		).toBe(true);
	});

	test('keeps backslashes literal inside single-quoted JSON payloads', () => {
		// POSIX single quotes preserve backslashes, so the CLI receives valid JSON
		// with escaped inner quotes. The tokenizer must not consume them.
		const command = [
			"STORYBOOK_FEATURE_AI_CLI=1 npx storybook ai --port 39497 display-review --json '{",
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
		expect(calls[0]?.name).toBe('display-review');
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

	test('does not credit ad hoc MCP invocations from the shell', () => {
		const calls = parseStorybookWorkflowShellCommands([
			'node scripts/mcp-call.mjs run-story-tests \'{"stories":[{"storyId":"example-button--primary"}]}\'',
			'curl http://127.0.0.1:6006/mcp/preview-stories --data \'{"params":{"arguments":{"stories":[{"storyId":"example-button--secondary"}]}}}\'',
		]);

		expect(calls).toHaveLength(0);
	});

	test('ignores shell redirections in storybook ai commands', () => {
		const calls = parseStorybookWorkflowShellCommands([
			'STORYBOOK_FEATURE_AI_CLI=1 npx storybook ai get-changed-stories 2>&1',
			'npx storybook ai --port 6006 run-story-tests >out.txt 2> err.log',
		]);

		expect(calls).toHaveLength(2);
		expect(calls[0]?.input).toEqual({});
		expect(calls[1]?.input).not.toHaveProperty('json');
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
			claudeToolUseLine('toolu_1', 'mcp__storybook-dev-mcp__run-story-tests', {}),
			claudeToolUseLine('toolu_2', 'mcp__storybook-dev-mcp__preview-stories', {}),
			claudeToolResultLine('toolu_2', [{ type: 'text', text: 'http://localhost:6006' }]),
			claudeToolResultLine('toolu_1', [
				{ type: 'text', text: '## Passing Stories\n\n- example-button--primary' },
			]),
		].join('\n');

		const results = parseWorkflowToolResults(transcript, 'run-story-tests');

		expect(results).toHaveLength(1);
		expect(results[0]?.output).toContain('## Passing Stories');
		expect(results[0]?.isError).toBe(false);
	});

	test('extracts Claude plugin-path results from storybook ai shell invocations', () => {
		const transcript = [
			claudeToolUseLine('toolu_1', 'Bash', {
				command: 'STORYBOOK_FEATURE_AI_CLI=1 npx storybook ai --port 6006 run-story-tests',
			}),
			claudeToolResultLine('toolu_1', '## Failing Stories\n\n### example-button--primary'),
		].join('\n');

		const results = parseWorkflowToolResults(transcript, 'run-story-tests');

		expect(results).toHaveLength(1);
		expect(results[0]?.output).toContain('## Failing Stories');
	});

	test('marks errored Claude tool results', () => {
		const transcript = [
			claudeToolUseLine('toolu_1', 'mcp__storybook-dev-mcp__run-story-tests', {}),
			claudeToolResultLine('toolu_1', 'Test run was cancelled', true),
		].join('\n');

		const results = parseWorkflowToolResults(transcript, 'run-story-tests');

		expect(results).toHaveLength(1);
		expect(results[0]?.isError).toBe(true);
	});

	test('extracts completed Codex MCP tool call results', () => {
		const transcript = [
			JSON.stringify({
				type: 'item.started',
				item: {
					type: 'mcp_tool_call',
					tool: 'run-story-tests',
					result: null,
					status: 'in_progress',
				},
			}),
			JSON.stringify({
				type: 'item.completed',
				item: {
					type: 'mcp_tool_call',
					tool: 'run-story-tests',
					status: 'completed',
					error: null,
					result: { content: [{ type: 'text', text: '## Passing Stories\n\n- a--b' }] },
				},
			}),
		].join('\n');

		const results = parseWorkflowToolResults(transcript, 'run-story-tests');

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
					command: "/bin/bash -lc 'npx storybook ai --port 6006 run-story-tests'",
					aggregated_output: '## Passing Stories\n\n- a--b\n\n## Failing Stories\n\n### a--c',
					exit_code: 0,
					status: 'completed',
				},
			}),
		].join('\n');

		const results = parseWorkflowToolResults(transcript, 'run-story-tests');

		expect(results).toHaveLength(1);
		expect(results[0]?.output).toContain('## Failing Stories');
	});

	test('ignores unrelated tools and unparseable lines', () => {
		const transcript = [
			'not json',
			claudeToolUseLine('toolu_1', 'Bash', { command: 'npm run lint' }),
			claudeToolResultLine('toolu_1', 'lint ok'),
		].join('\n');

		expect(parseWorkflowToolResults(transcript, 'run-story-tests')).toHaveLength(0);
	});
});
