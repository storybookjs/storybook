import { expect, test } from 'vitest';
import { expectWorkflowCalls, getWorkflowCalls } from '#test-utils';

test('reruns story tests after fixing failures and publishes a display review', () => {
	expectWorkflowCalls(['run-story-tests', 'display-review']);
	expect(getWorkflowCalls('run-story-tests').length).toBeGreaterThanOrEqual(2);
});
