import { test } from 'vitest';
import {
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

test.runIf(review)('the review covers the new AlertBanner stories', () => {
	expectStoryIdsInDisplayReview(['alertbanner']);
});

test.runIf(!review)(
	'uses Storybook story instructions and previews the new AlertBanner stories',
	() => {
		expectWorkflowCalls(['get-storybook-story-instructions']);
		expectPreviewStoriesWithFinalLinks({ covering: ['alertbanner'] });
	},
);

test.runIf(review)(
	'discovers stories through the workflow tools before publishing the review',
	() => {
		expectStoryDiscoveryBeforeReview();
	},
);

test('runs story tests after the change and finishes with them passing', () => {
	expectStoryTestsRanAndPassed({ covering: ['alertbanner'] });
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
