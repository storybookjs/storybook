import {
  expectDisplayReviewForVisualChange,
  expectPreviewBrowserStarted,
  expectPreviewStoriesWithFinalLinks,
  expectSkillInvoked,
  expectStoryDiscoveryBeforeReview,
  expectStoryIdsInDisplayReview,
  expectStoryTestsRanAndPassed,
  expectValidStorybookLaunchConfig,
  getEvalContext,
  getWorkflowCalls,
  getWorkflowToolResults,
  isReviewEnabled,
} from '#test-utils';
import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

describe('changing a shared accent token and surfacing consumer stories', () => {
  // The edited token file has no stories of its own, so the run must surface
  // the stories of its *consumers* (Badge and StatusPill).
  const review = isReviewEnabled();

  // Skipped for Codex+MCP with review on: edits the token file and ends the
  // turn with zero MCP calls (~every other run). Codex surfaces MCP server
  // instructions only as the tool namespace description, so for an edit it
  // judges trivial it never reads the storybook namespace. Review-off and
  // Codex+plugin runs pass consistently. Seen in three local runs on
  // 2026-07-03. Re-enable when the review-on workflow reliably reaches Codex
  // at turn start.
  const evalContext = getEvalContext();
  const codexMcpReviewGap =
    review && evalContext.agent === 'codex' && evalContext.integration === 'mcp';

  // The fallback assertions only count if the token change was actually done.
  test('changes the accent color token', () => {
    const colors = readFileSync('src/theme/colors.ts', 'utf8');
    expect(colors, 'Expected the accent token to change to #7c3aed').toMatch(/#7c3aed/i);
    expect(colors, 'Expected the old accent value #2563eb to be gone').not.toMatch(/#2563eb/i);
  });

  test.skipIf(codexMcpReviewGap)(
    'runs story tests after the change and finishes with them passing',
    () => {
      expectStoryTestsRanAndPassed({ covering: ['badge', 'statuspill'] });
    }
  );

  describe.runIf(review && !codexMcpReviewGap)('when review is enabled', () => {
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

  describe.runIf(!review)('when review is disabled', () => {
    // Any-of rather than both: the review-off instructions say to preview
    // "selected" storyIds from the discovery results, so surfacing one
    // consumer's stories is a legitimate selection.
    test('previews the consumer stories for the visual token change', () => {
      expectPreviewStoriesWithFinalLinks({ coveringAnyOf: ['badge', 'statuspill'] });
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
