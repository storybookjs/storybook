import { test } from 'vitest';
import { expectDisplayReviewForVisualChange, expectWorkflowCalls } from '#test-utils';

test('uses Storybook story instructions and publishes a display review', () => {
	expectWorkflowCalls(['get-storybook-story-instructions', 'display-review']);
	expectDisplayReviewForVisualChange();
});
