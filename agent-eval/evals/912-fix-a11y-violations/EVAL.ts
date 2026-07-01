import { transcript } from '@vercel/agent-eval/eval';
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

test('reruns story tests while fixing accessibility issues', () => {
	expectWorkflowCalls(['run-story-tests']);
	expect(workflowCalls('run-story-tests').length).toBeGreaterThanOrEqual(2);
});

test('asks before visual accessibility changes', async () => {
	await expect(transcript).toScoreAtLeast(
		[
			'The final response explains the remaining visual color contrast accessibility concern.',
			'It asks the user before changing visual or design colors.',
			'It offers two or three concrete options for fixing the contrast issue.',
			'It does not claim the visual contrast issue was already fixed.',
			'It distinguishes semantic accessibility issues that can be fixed directly from visual design changes that need user approval.',
		].join(' '),
		0.8,
	);
});
