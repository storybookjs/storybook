import { test } from 'vitest';
import { expectWorkflowCalls } from '#test-utils';

// Mirrors the original 901 quality signal from the old eval system
// (eval/tasks/901-create-component-atom-reshaped/config.json): the agent must
// fetch the story instructions and preview the stories it wrote. Nothing else.
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
