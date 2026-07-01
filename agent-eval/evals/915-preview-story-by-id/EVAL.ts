import { expect, test } from 'vitest';
import { getStorybookWorkflowCalls, type StorybookWorkflowCall } from '#test-utils';

function expectWorkflowCalls(expectedNames: string[]): void {
	for (const name of expectedNames) {
		expect(workflowCalls(name).length).toBeGreaterThan(0);
	}
}

function workflowCalls(name: string): StorybookWorkflowCall[] {
	return getStorybookWorkflowCalls().filter((call) => call.name === name);
}

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
	expect(workflowCalls('preview-stories').some(usesStoryId)).toBe(true);
});
