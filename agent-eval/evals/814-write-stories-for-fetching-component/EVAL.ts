import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import {
  expectAnyWorkflowSkillInvoked,
  expectFocusedTestRun,
  expectNoDisplayReview,
  expectNoOtherTestRunner,
  expectStoryTestsRanAndPassed,
  expectWorkflowCalls,
  getEvalContext,
} from '#test-utils';

const STORIES_PATH = 'stories/OrderHistory.stories.tsx';

// The skills of the workflow in AGENTS.md that this task cannot do without. The tests are a
// command of the workflow, not a skill, and a review only comes when the user asks for one.
const WORKFLOW_SKILLS = ['write-stories'];

describe('writing stories for an existing OrderHistory that fetches its data', () => {
  test('runs story tests after the change and finishes with them passing', async () => {
    await expectStoryTestsRanAndPassed({
      covering: ['orderhistory'],
    });
  });

  test('mocks the request instead of changing the component', () => {
    const component = readFileSync('src/components/OrderHistory.tsx', 'utf8');
    expect(component, 'Expected OrderHistory to keep taking no props').toMatch(
      /export default function OrderHistory\s*\(\s*\)/
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

  test('runs the skills of the workflow, tests what it changed, and publishes no review unasked', () => {
    expectWorkflowCalls(WORKFLOW_SKILLS);
    expectFocusedTestRun();
    expectNoOtherTestRunner();
    expectNoDisplayReview();
  });

  describe('depending on the current agent and integration', () => {
    const { integration } = getEvalContext();

    test.skipIf(integration === 'mcp')('finds the workflow through the plugin skills', () => {
      expectAnyWorkflowSkillInvoked();
    });
  });
});
