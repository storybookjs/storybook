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

function includesStoryIds(call: StorybookWorkflowCall): boolean {
	return call.input.withStoryIds === true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

test('discovers story IDs before previewing by ID', () => {
	expectWorkflowCalls(['list-all-documentation', 'preview-stories']);
	expect(getWorkflowCalls('list-all-documentation').some(includesStoryIds)).toBe(true);
	expect(getWorkflowCalls('preview-stories').some(usesStoryId)).toBe(true);
});
