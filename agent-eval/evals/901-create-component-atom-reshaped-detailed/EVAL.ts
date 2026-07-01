import { transcript } from '@vercel/agent-eval/eval';
import { expect, test } from 'vitest';
import { expectDisplayReviewForVisualChange, expectWorkflowCalls } from '#test-utils';

test('uses Storybook story instructions and publishes a display review', () => {
	expectWorkflowCalls(['get-storybook-story-instructions', 'display-review']);
	expectDisplayReviewForVisualChange();
});

test('curates the display review for the ToggleSwitch change', async () => {
	await expect(transcript).toSatisfyCriterion(
		[
			'The transcript shows a useful Storybook display-review for the ToggleSwitch UI change.',
			'Pass only if the display-review payload includes the important created ToggleSwitch story states, such as on, off, and disabled.',
			'Pass only if the review payload has a clear title, description, and collection rationale that explain why those stories are relevant to visually review.',
			'Pass only if changedFiles includes the changed ToggleSwitch component and story files.',
			'Pass only if the final response ends with the dedicated review section and does not also dump individual preview links.',
		].join(' '),
	);
});
