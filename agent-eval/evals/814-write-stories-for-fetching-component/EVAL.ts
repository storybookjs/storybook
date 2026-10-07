import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import {
  expectDevServerLeftRunning,
  expectDisplayReviewForVisualChange,
  expectPreviewOpenedInBrowser,
  expectPreviewStoriesWithFinalLinks,
  expectReviewOpenedInBrowser,
  expectSkillInvoked,
  expectStoryDiscoveryBeforeReview,
  expectStoryIdsInDisplayReview,
  expectStoryTestsRanAndPassed,
  expectWorkflowCalls,
  getEvalContext,
  isReviewEnabled,
} from '#test-utils';

const STORIES_PATH = 'stories/OrderHistory.stories.tsx';

describe('writing stories for an existing OrderHistory that fetches its data', () => {
  const review = isReviewEnabled();

  test('runs story tests after the change and finishes with them passing', async () => {
    await expectStoryTestsRanAndPassed({ covering: ['orderhistory'] });
  });

  test('mocks the request instead of changing the component', () => {
    const component = readFileSync('src/components/OrderHistory.tsx', 'utf8');
    expect(component, 'Expected OrderHistory to keep taking no props').toMatch(
      /export default function OrderHistory\(\)/
    );
    expect(component, 'Expected OrderHistory to keep fetching /api/orders').toMatch(
      /fetch\(\s*['"`]\/api\/orders/
    );

    expect(existsSync(STORIES_PATH), `Expected the stories in ${STORIES_PATH}`).toBe(true);
    const stories = readFileSync(STORIES_PATH, 'utf8');
    expect(stories, 'Expected the stories to mock /api/orders').toMatch(/\/api\/orders/);
    expect(
      stories.match(/^export const \w+/gm)?.length ?? 0,
      'Expected loaded, empty, and error stories'
    ).toBeGreaterThanOrEqual(3);
  });

  test('uses the msw-storybook-addon 3 API instead of parameters.msw', () => {
    const stories = readFileSync(STORIES_PATH, 'utf8');
    expect(stories, 'Expected handlers registered with msw.use').toMatch(/\bmsw\.use\(/);
    expect(stories, 'Expected no deprecated parameters.msw handlers').not.toMatch(
      /\bmsw\s*:\s*[{[]/
    );
  });

  describe.runIf(review)('when review is enabled', () => {
    test('uses Storybook story instructions and publishes a display review', () => {
      expectWorkflowCalls(['get-storybook-story-instructions', 'review-create']);
      expectDisplayReviewForVisualChange();
    });

    test('opens the review in the in-app browser', () => {
      expectReviewOpenedInBrowser();
    });

    test('the review covers the new OrderHistory stories', () => {
      expectStoryIdsInDisplayReview(['orderhistory']);
    });

    test('discovers stories through the workflow tools before publishing the review', () => {
      expectStoryDiscoveryBeforeReview();
    });
  });

  describe.runIf(!review)('when review is disabled', () => {
    test('uses Storybook story instructions and previews the new OrderHistory stories', () => {
      expectWorkflowCalls(['get-storybook-story-instructions']);
      expectPreviewStoriesWithFinalLinks({ covering: ['orderhistory'] });
    });

    test('opens a story preview in the in-app browser', () => {
      expectPreviewOpenedInBrowser();
    });
  });

  describe('depending on the current agent and integration', () => {
    const { integration } = getEvalContext();

    test.skipIf(integration === 'mcp')('invokes the stories skill', () => {
      expectSkillInvoked('stories');
    });

    test.skipIf(integration !== 'plugin')(
      'leaves the dev server running when using the plugin',
      () => {
        expectDevServerLeftRunning();
      }
    );
  });
});
