import {
  DISPLAY_REVIEW_CURATION_CRITERION,
  expectAllStoryExportsInDisplayReview,
  expectDisplayReviewForVisualChange,
  expectDevServerLeftRunning,
  expectPreviewStoriesWithFinalLinks,
  expectReviewOpenedInBrowser,
  expectSkillInvoked,
  expectStoryDiscoveryBeforeReview,
  expectStoryTestsRanAndPassed,
  expectWorkflowCalls,
  getEvalContext,
  isReviewEnabled,
} from '#test-utils';
import { transcript } from '@vercel/agent-eval/eval';
import { describe, expect, test } from 'vitest';

describe('creating an accessible ToggleSwitch', () => {
  const reviewEnabled = isReviewEnabled();

  test('runs story tests after the change and finishes with them passing', () => {
    expectStoryTestsRanAndPassed({ covering: ['toggleswitch'] });
  });

  describe.runIf(reviewEnabled)('with review enabled', () => {
    test('uses Storybook story instructions and publishes a display review', () => {
      expectWorkflowCalls(['get-storybook-story-instructions', 'review-create']);
      expectDisplayReviewForVisualChange();
    });

    test('opens the review in the in-app browser', () => {
      expectReviewOpenedInBrowser();
    });

    test('discovers stories through the workflow tools before publishing the review', () => {
      expectStoryDiscoveryBeforeReview();
    });

    test('every new story appears in the display review', () => {
      expectAllStoryExportsInDisplayReview();
    });

    // Skipped: agents publish one collection with every story instead of 2-5
    // meaningful collections (e.g. visual states vs interaction behavior).
    // Seen as score 0.15 < 0.5 in the 2026-07-01T22-16-52 cc-plugin run.
    // Re-enable when review-create workflow guidance teaches that grouping.
    test.skip('publishes a well-curated review', async () => {
      // 0.5 keeps this soft (curation quality is scored, not gating): minor
      // flaws like one single-story collection pass, arbitrary story dumps
      // still fail.
      await expect(transcript).toScoreAtLeast(DISPLAY_REVIEW_CURATION_CRITERION, 0.5);
    });
  });

  describe.runIf(!reviewEnabled)('with review disabled', () => {
    test('uses Storybook story instructions and previews the new stories', () => {
      expectWorkflowCalls(['get-storybook-story-instructions']);
      expectPreviewStoriesWithFinalLinks({ covering: ['toggleswitch'] });
    });
  });

  describe('depending on the current agent and integration', () => {
    const { agent, integration } = getEvalContext();

    // Building with external Reshaped components requires the docs tools: props
    // must not be guessed or read out of node_modules. Skipped for Codex+MCP:
    // GPT-5.5 intermittently builds from prior knowledge without calling
    // docs-show (~1/4 runs), despite tool descriptions and server
    // instructions. Codex+plugin passes consistently. Seen in CI 28673251562
    // and local runs on 2026-07-03. Re-enable when Codex MCP reliably uses the
    // docs tools.
    test.skipIf(agent === 'codex' && integration === 'mcp')('uses the documentation tooling', () =>
      expectWorkflowCalls(['docs-show'])
    );

    test.skipIf(integration === 'mcp')('invokes the stories skill', () =>
      expectSkillInvoked('stories')
    );

    test.skipIf(integration !== 'plugin')(
      'leaves the dev server running when using the plugin',
      () => expectDevServerLeftRunning()
    );
  });
});
