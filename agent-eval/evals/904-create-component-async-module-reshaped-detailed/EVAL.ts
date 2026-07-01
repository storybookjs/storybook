import { test } from 'vitest';
import { expectDisplayReviewForVisualChange, expectWorkflowCalls } from '#test-utils';

test('uses the Storybook creation, test, and review workflow', () => {
	expectWorkflowCalls(['get-storybook-story-instructions', 'run-story-tests', 'display-review']);
	expectDisplayReviewForVisualChange();
});
