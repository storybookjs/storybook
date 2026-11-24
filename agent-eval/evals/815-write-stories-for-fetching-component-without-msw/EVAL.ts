import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import {
  expectAnyWorkflowSkillInvoked,
  expectFinalResponseMatches,
  expectNoDisplayReview,
  expectWorkflowCalls,
  getEvalContext,
} from '#test-utils';

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
    // Every story of a component that fetches needs a network mock, so without MSW there is none.
    // The main config loads stories from `src` and from `stories`.
    const storyFiles = ['src', 'stories']
      .filter((dir) => existsSync(dir))
      .flatMap((dir) =>
        readdirSync(dir, { recursive: true, encoding: 'utf8' }).map((name) => `${dir}/${name}`)
      )
      .filter((file) => file.includes('.stories.'));
    for (const file of storyFiles) {
      const stories = readFileSync(file, 'utf8');
      // A file with only a meta renders nothing.
      const rendersOrderHistory =
        /from ['"][^'"]*\/OrderHistory(?:\.[jt]sx?)?['"]/.test(stories) &&
        /^export const /m.test(stories);
      expect(
        rendersOrderHistory,
        `Expected ${file} to have no story that renders OrderHistory without a network mock`
      ).toBe(false);
      expect(stories, `Expected no module mock or stubbed fetch in ${file}`).not.toMatch(
        /\bsb\.mock\(|\bvi\.mock\(|\bmocked\(|\bspyOn\(|\b(globalThis|global|window)\.fetch\s*=/
      );
    }
  });

  test('tells the user that the stories that fetch need MSW', () => {
    expectFinalResponseMatches([/\bMSW\b|msw-storybook-addon|network mock/i]);
  });

  test('runs the write-stories skill, and creates no review unasked', () => {
    expectWorkflowCalls(WORKFLOW_SKILLS);
    expectNoDisplayReview();
  });

  test.skipIf(getEvalContext().integration === 'mcp')(
    'finds the workflow through the plugin skills',
    () => {
      expectAnyWorkflowSkillInvoked();
    }
  );
});
