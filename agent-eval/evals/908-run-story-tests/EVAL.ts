import { test } from 'vitest';
import { expectWorkflowCalls } from '#test-utils';

test('runs Storybook story tests', () => {
	expectWorkflowCalls(['run-story-tests']);
});
