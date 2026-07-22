import { test } from 'vitest';
import { expectWorkflowCalls } from '#test-utils';

// 9xx ports assert the old MCP-only workflow and nothing more: fetch the
// story instructions and preview the stories written.
test('uses Storybook story instructions', () => {
  expectWorkflowCalls(['get-storybook-story-instructions']);
});

test('previews the stories', () => {
  expectWorkflowCalls(['preview-stories']);
});

// Not part of the original eval: added to track whether agents use the
// documentation tools for the external Reshaped components.
test('uses the documentation tooling', () => {
  expectWorkflowCalls(['get-documentation']);
});
