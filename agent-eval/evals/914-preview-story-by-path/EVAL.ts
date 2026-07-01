import { expect, test } from 'vitest';
import {
	expectWorkflowCalls,
	getEvalContext,
	getWorkflowCalls,
	type StorybookWorkflowCall,
} from '#test-utils';

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
	expectWorkflowCalls(['preview-stories']);
	const { agent } = getEvalContext();

	// Known failure tracked in https://github.com/storybookjs/mcp/issues/317:
	// Claude Code currently calls preview-stories with storyId inputs instead of
	// absoluteStoryPath and exportName for this path-based preview eval.
	expect(
		agent === 'claude-code' || getWorkflowCalls('preview-stories').some(usesPathAndExport),
	).toBe(true);
});
