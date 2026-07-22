import { expect, test } from 'vitest';
import {
	expectWorkflowCalls,
	getWorkflowCalls,
	type StorybookWorkflowCall,
	workflowCallIncludesStory,
	workflowCallUsesStoryId,
} from '#test-utils';

function includesStoryIds(call: StorybookWorkflowCall): boolean {
	return call.input.withStoryIds === true;
}

test('discovers story IDs before previewing by ID', () => {
	const previewCalls = getWorkflowCalls('preview-stories');
	expectWorkflowCalls(['list-all-documentation', 'preview-stories']);
	expect(getWorkflowCalls('list-all-documentation').some(includesStoryIds)).toBe(true);
	expect(previewCalls.some(workflowCallUsesStoryId)).toBe(true);
	expect(
		previewCalls.some((call) =>
			workflowCallIncludesStory(call, { storyId: 'example-button--primary' }),
		),
	).toBe(true);
	expect(
		previewCalls.some((call) =>
			workflowCallIncludesStory(call, { storyId: 'example-button--secondary' }),
		),
	).toBe(true);
});
