import { describe, test } from 'vitest';
import { expectWorkflowCalls } from '#test-utils';

describe('creating an accessible ToggleSwitch with a concise prompt', () => {
  // 9xx ports assert the old MCP-only workflow and nothing more: fetch the
  // story instructions and preview the stories written.
  test('uses Storybook story instructions', () => {
    expectWorkflowCalls(['get-storybook-story-instructions']);
  });

  test('previews the stories', () => {
    expectWorkflowCalls(['preview-stories']);
  });

  describe('depending on the current agent and integration', () => {
    // Not part of the original eval: added to track whether agents use the
    // documentation tools for the external Reshaped components.
    test('uses the documentation tooling', () => {
      expectWorkflowCalls(['get-documentation']);
    });
  });
});
