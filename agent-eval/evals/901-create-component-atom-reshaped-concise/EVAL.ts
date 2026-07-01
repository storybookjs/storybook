import { test } from 'vitest';
import { expectDisplayReviewForVisualChange, expectWorkflowCalls } from '#test-utils';

test('uses Storybook story instructions and publishes a display review', () => {
	// Known failure tracked in https://github.com/storybookjs/mcp/issues/317:
	// cc-mcp can complete this workflow but produce a story that fails lint by
	// calling React hooks directly inside a Storybook render callback.
	expectWorkflowCalls(['get-storybook-story-instructions', 'display-review']);
	expectDisplayReviewForVisualChange();
});
