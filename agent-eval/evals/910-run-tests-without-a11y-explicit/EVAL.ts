import { expect, test } from 'vitest';
import { expectWorkflowCalls, getWorkflowCalls, type StorybookWorkflowCall } from '#test-utils';

function disablesA11y(call: StorybookWorkflowCall): boolean {
	return call.input.a11y === false;
}

test('runs Storybook story tests with a11y disabled', () => {
	expectWorkflowCalls(['run-story-tests']);
	expect(getWorkflowCalls('run-story-tests').some(disablesA11y)).toBe(true);
});
