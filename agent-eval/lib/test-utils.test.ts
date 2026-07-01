import { describe, expect, test } from 'vitest';
import {
	parseStorybookWorkflowShellCommands,
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

	test('parses mcp-call script workflow input', () => {
		const calls = parseStorybookWorkflowShellCommands([
			'node scripts/mcp-call.mjs run-story-tests \'{"stories":[{"storyId":"example-button--primary"}]}\'',
		]);

		expect(calls).toHaveLength(1);
		expect(calls[0]?.name).toBe('run-story-tests');
		expect(
			calls.some((call) => workflowCallIncludesStory(call, { storyId: 'example-button--primary' })),
		).toBe(true);
	});

	test('parses curl workflow input', () => {
		const calls = parseStorybookWorkflowShellCommands([
			'curl http://127.0.0.1:6006/mcp/preview-stories --data \'{"params":{"arguments":{"stories":[{"storyId":"example-button--secondary"}]}}}\'',
		]);

		expect(calls).toHaveLength(1);
		expect(calls[0]?.name).toBe('preview-stories');
		expect(
			calls.some((call) =>
				workflowCallIncludesStory(call, { storyId: 'example-button--secondary' }),
			),
		).toBe(true);
	});
});
