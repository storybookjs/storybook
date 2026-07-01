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

function hasStoriesInput(call: StorybookWorkflowCall): boolean {
	return Array.isArray(call.input.stories) && call.input.stories.length > 0;
}

test('creates stories, runs focused story tests, and publishes a display review', () => {
	expectWorkflowCalls(['get-storybook-story-instructions', 'run-story-tests', 'display-review']);
	expect(workflowCalls('run-story-tests').some(hasStoriesInput)).toBe(true);
});
