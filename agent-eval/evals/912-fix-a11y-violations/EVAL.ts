import { transcript } from '@vercel/agent-eval/eval';
import { expect, test } from 'vitest';
import {
	A11Y_VISUAL_CHANGE_APPROVAL_CRITERION,
	expectWorkflowCalls,
	getWorkflowCalls,
} from '#test-utils';

test('reruns story tests while fixing accessibility issues', () => {
	expectWorkflowCalls(['run-story-tests']);
	expect(getWorkflowCalls('run-story-tests').length).toBeGreaterThanOrEqual(2);
});

test('asks before visual accessibility changes', async () => {
	await expect(transcript).toScoreAtLeast(A11Y_VISUAL_CHANGE_APPROVAL_CRITERION, 0.8);
});
