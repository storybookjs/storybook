import { describe, test } from 'vitest';
import { expectWorkflowCalls } from '#test-utils';

describe('creating a NotificationsList that fetches with explicit stories requested', () => {
  test('uses the Storybook creation, test, and preview workflow', () => {
    expectWorkflowCalls(['ui-workflow', 'test-run', 'stories-preview']);
  });
});
