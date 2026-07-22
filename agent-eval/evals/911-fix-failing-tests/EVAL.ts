import { expect, test } from 'vitest';
import { expectWorkflowCalls, getWorkflowCalls } from '#test-utils';

test('reruns story tests after fixing failures and previews the stories', () => {
	expectWorkflowCalls(['run-story-tests', 'preview-stories']);
	expect(getWorkflowCalls('run-story-tests').length).toBeGreaterThanOrEqual(2);
});
