import { existsSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
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

describe('creating a Callout in a monorepo UI package', () => {
  // Workflow asserts are enabled. The stories skills direct the dev server and
  // every Storybook CLI command to the package where Storybook is installed,
  // which avoids the degraded help output at the monorepo root (historical
  // context: storybookjs/storybook#35359).

  const review = isReviewEnabled();

  test('creates the component inside the leaf package', () => {
    expect(
      existsSync('packages/ui/src/components/Callout.tsx'),
      'Expected packages/ui/src/components/Callout.tsx to be created'
    ).toBe(true);
  });

  test('runs story tests after the change and finishes with them passing', () => {
    expectStoryTestsRanAndPassed({ covering: ['callout'] });
  });

  describe.runIf(review)('when review is enabled', () => {
    test('uses Storybook story instructions and publishes a display review', () => {
      expectWorkflowCalls(['get-storybook-story-instructions', 'review-create']);
      expectDisplayReviewForVisualChange();
    });

    test('the review covers the new Callout stories', () => {
      expectStoryIdsInDisplayReview(['callout']);
    });

    test('discovers stories through the workflow tools before publishing the review', () => {
      expectStoryDiscoveryBeforeReview();
    });
  });

  describe.runIf(!review)('when review is disabled', () => {
    test('uses Storybook story instructions and previews the new stories', () => {
      expectWorkflowCalls(['get-storybook-story-instructions']);
      expectPreviewStoriesWithFinalLinks({ covering: ['callout'] });
    });
  });

  describe('depending on the current agent and integration', () => {
    const { agent, integration } = getEvalContext();

    test.skipIf(integration === 'mcp')('invokes the stories skill', () => {
      expectSkillInvoked('stories');
    });

    test.skipIf(agent !== 'claude-code' || integration !== 'plugin')(
      'keeps the pre-existing Storybook launch config valid',
      () => {
        expectValidStorybookLaunchConfig();
      }
    );

    test.skipIf(integration !== 'plugin')('opens the preview browser when using the plugin', () => {
      expectPreviewBrowserStarted();
    });
  });
});
