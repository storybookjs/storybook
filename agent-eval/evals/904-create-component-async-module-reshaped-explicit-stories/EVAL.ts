import { describe, test } from 'vitest';
import { expectWorkflowCalls } from '#test-utils';

describe('creating an InventoryList that loads via getInventory with explicit stories requested', () => {
  test('uses the Storybook creation, test, and preview workflow', () => {
    expectWorkflowCalls(['get-storybook-story-instructions', 'run-story-tests', 'preview-stories']);
  });
});
