import { expect, test } from 'vitest';
import { getEvalContext, getWorkflowCalls, type StorybookWorkflowCall } from '#test-utils';

function usesPathAndExport(call: StorybookWorkflowCall): boolean {
	if (
		typeof call.input.absoluteStoryPath === 'string' &&
		typeof call.input.exportName === 'string'
	) {
		return true;
	}

	const stories = call.input.stories;
	return (
		Array.isArray(stories) &&
		stories.some((story) => {
			return (
				isRecord(story) &&
				typeof story.absoluteStoryPath === 'string' &&
				typeof story.exportName === 'string'
			);
		})
	);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

test('previews stories using path and export inputs', () => {
	const { agent, integration } = getEvalContext();
	const previewCalls = getWorkflowCalls('preview-stories');

	// Known failure tracked in https://github.com/storybookjs/mcp/issues/317:
	// Claude Code plugin can invoke preview-stories through direct HTTP/curl,
	// which returns the right result but is not parsed as a Storybook workflow call.
	expect(
		(agent === 'claude-code' && integration === 'plugin') || previewCalls.length > 0,
		'Expected preview-stories to be called',
	).toBe(true);

	// Known failure tracked in https://github.com/storybookjs/mcp/issues/317:
	// Claude Code and Codex plugin can call preview-stories with storyId inputs
	// instead of absoluteStoryPath and exportName for this path-based preview eval.
	expect(
		agent === 'claude-code' ||
			(agent === 'codex' && integration === 'plugin') ||
			previewCalls.some(usesPathAndExport),
	).toBe(true);
});
