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

test('reruns story tests after fixing failures and publishes a display review', () => {
	expectWorkflowCalls(['run-story-tests', 'display-review']);
	expect(workflowCalls('run-story-tests').length).toBeGreaterThanOrEqual(2);
});
