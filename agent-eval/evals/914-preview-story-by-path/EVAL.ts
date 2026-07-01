import { expect, test } from 'vitest';
import { expectWorkflowCalls, getWorkflowCalls, workflowCallIncludesStory } from '#test-utils';

test('previews the requested stories from the file path prompt', () => {
	const previewCalls = getWorkflowCalls('preview-stories');
	expectWorkflowCalls(['preview-stories']);
	expect(
		previewCalls.some((call) =>
			workflowCallIncludesStory(call, {
				absoluteStoryPath: 'stories/Button.stories.tsx',
				exportName: 'Primary',
				storyId: 'example-button--primary',
			}),
		),
	).toBe(true);
	expect(
		previewCalls.some((call) =>
			workflowCallIncludesStory(call, {
				absoluteStoryPath: 'stories/Button.stories.tsx',
				exportName: 'Secondary',
				storyId: 'example-button--secondary',
			}),
		),
	).toBe(true);
});
