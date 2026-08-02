import { describe, test } from 'vitest';
import { expectWorkflowCalls } from '#test-utils';

describe('creating a ProfileCard with a detailed prompt', () => {
  test('uses the Storybook creation, test, and preview workflow', () => {
    expectWorkflowCalls(['get-storybook-story-instructions', 'run-story-tests', 'preview-stories']);
  });
});
