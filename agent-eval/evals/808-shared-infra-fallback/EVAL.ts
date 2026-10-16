import {
  expectDisplayReviewForVisualChange,
  expectDevServerLeftRunning,
  expectSkillInvoked,
  expectStoryDiscoveryBeforeReview,
  expectStoryIdsInDisplayReview,
  expectStoryTestsRanAndPassed,
  getEvalContext,
  getWorkflowCalls,
  getWorkflowToolResults,
} from '#test-utils';
import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

describe('changing a shared accent token and surfacing consumer stories', () => {
  // The edited token file has no stories of its own, so the run must surface
  // the stories of its *consumers* (Badge and StatusPill).

  // The fallback assertions only count if the token change was actually done.
  test('changes the accent color token', () => {
    const colors = readFileSync('src/theme/colors.ts', 'utf8');
    expect(colors, 'Expected the accent token to change to #7c3aed').toMatch(/#7c3aed/i);
    expect(colors, 'Expected the old accent value #2563eb to be gone').not.toMatch(/#2563eb/i);
  });

  test('runs story tests after the change and finishes with them passing', async () => {
    await expectStoryTestsRanAndPassed({
      covering: ['badge', 'statuspill'],
    });
  });

  describe('reviewing the visual token change', () => {
    test('publishes a display review for the visual token change', () => {
      expectDisplayReviewForVisualChange();
    });

    test('the review surfaces the consumer stories, not the token file', () => {
      expectStoryIdsInDisplayReview(['badge', 'statuspill']);
    });

    test('discovers stories through the workflow tools before publishing the review', () => {
      expectStoryDiscoveryBeforeReview();
    });

    // Deliberately conditional: the module graph's related-stories detection can
    // legitimately surface both consumers from the diff alone, and that is
    // correct behavior; the fallback is only required when it doesn't.
    test('falls back to stories-find-by-component when the diff does not cover the consumers', () => {
      const changedStoriesResults = getWorkflowToolResults('stories-changed');
      const lastChangedStories = changedStoriesResults.at(-1);
      const diffCoversConsumers =
        lastChangedStories !== undefined &&
        !lastChangedStories.isError &&
        /badge/i.test(lastChangedStories.output) &&
        /statuspill/i.test(lastChangedStories.output);

      if (diffCoversConsumers) {
        return;
      }

      expect(
        getWorkflowCalls('stories-find-by-component').length,
        'stories-changed did not surface the consumer stories, so stories-find-by-component must be used'
      ).toBeGreaterThan(0);
    });
  });

  describe('depending on the current agent and integration', () => {
    const { integration } = getEvalContext();

    test.skipIf(integration === 'mcp')('invokes the ui-workflow skill', () => {
      expectSkillInvoked('ui-workflow');
    });

    test.skipIf(integration !== 'plugin')(
      'leaves the dev server running when using the plugin',
      () => {
        expectDevServerLeftRunning();
      }
    );
  });
});
