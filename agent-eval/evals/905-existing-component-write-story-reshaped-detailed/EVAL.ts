import { test } from 'vitest';
import { expectWorkflowCalls } from '#test-utils';

test('uses the Storybook creation, test, and preview workflow', () => {
  expectWorkflowCalls(['get-storybook-story-instructions', 'test-run', 'stories-preview']);
});
