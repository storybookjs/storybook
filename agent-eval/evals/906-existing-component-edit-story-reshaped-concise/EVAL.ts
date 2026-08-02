import { describe, test } from 'vitest';
import { expectWorkflowCalls } from '#test-utils';

describe('fixing PlanCard stories to match current props with a concise prompt', () => {
  test('uses the Storybook creation, test, and preview workflow', () => {
    expectWorkflowCalls(['get-storybook-story-instructions', 'run-story-tests', 'preview-stories']);
  });
});
