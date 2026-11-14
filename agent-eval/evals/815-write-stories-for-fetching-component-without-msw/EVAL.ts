import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import {
  expectAnyWorkflowSkillInvoked,
  expectFinalResponseMatches,
  expectNoDisplayReview,
  expectNoOtherTestRunner,
  expectWorkflowCalls,
  getEvalContext,
} from '#test-utils';

const STORIES_PATH = 'src/components/OrderHistory.stories.tsx';

// The skills of the workflow in AGENTS.md that this task cannot do without. The tests are a
// command of the workflow, not a skill, and a review only comes when the user asks for one.
const WORKFLOW_SKILLS = ['write-stories'];

// The project has no MSW setup. Adding a dependency is the team's decision, not a skill's: the
// agent writes the stories that need no network (here none), adds nothing, and tells the user
// what the stories that fetch would need.
describe('writing stories for a fetching OrderHistory in a project without MSW', () => {
  test('adds no dependency and no MSW setup', () => {
    const { dependencies = {}, devDependencies = {} } = JSON.parse(
      readFileSync('package.json', 'utf8')
    );
    const installed = { ...dependencies, ...devDependencies };
    expect(installed, 'Expected msw not to be installed').not.toHaveProperty('msw');
    expect(installed, 'Expected msw-storybook-addon not to be installed').not.toHaveProperty(
      'msw-storybook-addon'
    );
    expect(
      existsSync('public/mockServiceWorker.js'),
      'Expected no worker script from `msw init`'
    ).toBe(false);
    const preview = readdirSync('.storybook').find((file) => file.startsWith('preview.'));
    expect(
      readFileSync(`.storybook/${preview}`, 'utf8'),
      'Expected the preview file to stay without msw-storybook-addon'
    ).not.toMatch(/msw/);
  });

  test('leaves the component as it is, and mocks no module or fetch instead', () => {
    const component = readFileSync('src/components/OrderHistory.tsx', 'utf8');
    expect(component, 'Expected OrderHistory to keep taking no props').toMatch(
      /export default function OrderHistory\s*\(\s*\)/
    );
    expect(component, 'Expected OrderHistory to keep fetching /api/orders').toMatch(
      /fetch\(\s*['"`]\/api\/orders/
    );
    if (existsSync(STORIES_PATH)) {
      expect(
        readFileSync(STORIES_PATH, 'utf8'),
        'Expected no module mock or stubbed fetch'
      ).not.toMatch(
        /\bsb\.mock\(|\bvi\.mock\(|\bmocked\(|\bspyOn\(|\b(globalThis|window)\.fetch\s*=/
      );
    }
  });

  test('tells the user that the stories that fetch need MSW', () => {
    expectFinalResponseMatches([/\bMSW\b|msw-storybook-addon|network mock/i]);
  });

  test('runs the write-stories skill, and publishes no review unasked', () => {
    expectWorkflowCalls(WORKFLOW_SKILLS);
    expectNoOtherTestRunner();
    expectNoDisplayReview();
  });

  test.skipIf(getEvalContext().integration === 'mcp')(
    'finds the workflow through the plugin skills',
    () => {
      expectAnyWorkflowSkillInvoked();
    }
  );
});
