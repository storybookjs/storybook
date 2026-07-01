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

function disablesA11y(call: StorybookWorkflowCall): boolean {
	return call.input.a11y === false;
}

test('runs Storybook story tests with a11y disabled', () => {
	expectWorkflowCalls(['run-story-tests']);
	expect(workflowCalls('run-story-tests').some(disablesA11y)).toBe(true);
});
