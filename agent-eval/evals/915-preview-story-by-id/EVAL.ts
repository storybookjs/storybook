import { expect, test } from 'vitest';
import { expectWorkflowCalls, getWorkflowCalls, type StorybookWorkflowCall } from '#test-utils';

function usesStoryId(call: StorybookWorkflowCall): boolean {
	if (typeof call.input.storyId === 'string') {
		return true;
	}

	const stories = call.input.stories;
	return (
		Array.isArray(stories) &&
		stories.some((story) => isRecord(story) && typeof story.storyId === 'string')
	);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

test('previews stories using story IDs', () => {
	expectWorkflowCalls(['preview-stories']);
	expect(getWorkflowCalls('preview-stories').some(usesStoryId)).toBe(true);
});
