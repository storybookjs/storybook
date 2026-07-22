import { test } from 'vitest';
import { expectWorkflowCalls } from '#test-utils';

test('uses Storybook story instructions and previews the stories', () => {
	expectWorkflowCalls(['get-storybook-story-instructions', 'preview-stories']);
});
