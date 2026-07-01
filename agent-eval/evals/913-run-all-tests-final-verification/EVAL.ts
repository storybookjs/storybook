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

function runsAllStories(call: StorybookWorkflowCall): boolean {
	return (
		!('stories' in call.input) ||
		(Array.isArray(call.input.stories) && call.input.stories.length === 0)
	);
}

test('runs the full Storybook story test suite', () => {
	expectWorkflowCalls(['run-story-tests']);
	expect(workflowCalls('run-story-tests').some(runsAllStories)).toBe(true);
});
