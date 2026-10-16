import { describe, test } from 'vitest';
import { expectWorkflowCalls } from '#test-utils';

describe('fixing PlanCard stories to match current props with a detailed prompt', () => {
  test('uses the Storybook creation, test, and preview workflow', () => {
    expectWorkflowCalls(['get-storybook-story-instructions', 'test-run', 'stories-preview']);
  });
});
