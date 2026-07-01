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
