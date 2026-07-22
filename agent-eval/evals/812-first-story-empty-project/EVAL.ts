import { test } from 'vitest';
import {
	expectAllStoryExportsInDisplayReview,
	expectDisplayReviewForVisualChange,
	expectPreviewBrowserStarted,
	expectPreviewStoriesWithFinalLinks,
	expectSkillInvoked,
	getEvalContext,
	expectStoryDiscoveryBeforeReview,
	expectStoryIdsInDisplayReview,
	expectStoryTestsRanAndPassed,
	expectValidStorybookLaunchConfig,
	expectWorkflowCalls,
	isReviewEnabled,
} from '#test-utils';

const review = isReviewEnabled();

test.runIf(review)('uses Storybook story instructions and publishes a display review', () => {
	expectWorkflowCalls(['get-storybook-story-instructions', 'display-review']);
	expectDisplayReviewForVisualChange();
});

test.runIf(review)('the review covers the new Button stories', () => {
	expectStoryIdsInDisplayReview(['button']);
});

test.runIf(!review)('uses Storybook story instructions and previews the new stories', () => {
	expectWorkflowCalls(['get-storybook-story-instructions']);
	expectPreviewStoriesWithFinalLinks({ covering: ['button'] });
});

test.runIf(review)('every new story appears in the display review', () => {
	expectAllStoryExportsInDisplayReview();
});

test.runIf(review)(
	'discovers stories through the workflow tools before publishing the review',
	() => {
		expectStoryDiscoveryBeforeReview();
	},
);

test('runs story tests after the change and finishes with them passing', () => {
	expectStoryTestsRanAndPassed({ covering: ['button'] });
});

test.skipIf(getEvalContext().integration === 'mcp')('invokes the stories skill', () => {
	expectSkillInvoked('stories');
});

test('keeps the pre-existing Storybook launch config valid', () => {
	expectValidStorybookLaunchConfig();
});

test('opens the preview browser when using the plugin', () => {
	expectPreviewBrowserStarted();
});
