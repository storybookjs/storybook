import { expect, test } from 'vitest';
import { expectWorkflowCalls, getWorkflowCalls, type StorybookWorkflowCall } from '#test-utils';

function hasStoriesInput(call: StorybookWorkflowCall): boolean {
	return Array.isArray(call.input.stories) && call.input.stories.length > 0;
}

test('creates stories, runs focused story tests, and publishes a display review', () => {
	expectWorkflowCalls(['get-storybook-story-instructions', 'run-story-tests', 'display-review']);
	expect(getWorkflowCalls('run-story-tests').some(hasStoriesInput)).toBe(true);
});
