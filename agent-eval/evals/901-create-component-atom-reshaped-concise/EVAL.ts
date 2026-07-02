import { test } from 'vitest';
import { expectAnyWorkflowCall, expectWorkflowCalls } from '#test-utils';

// Mirrors the original 901 quality signal from the old eval system
// (eval/tasks/901-create-component-atom-reshaped/config.json): the agent must
// fetch the story instructions and surface the stories it wrote. Nothing else.
test('uses Storybook story instructions', () => {
	expectWorkflowCalls(['get-storybook-story-instructions']);
});

// On the stable (`latest`) stack the surfacing endpoint is preview-stories;
// on the current stack the display-review flow supersedes it (the workflow
// says "show one set of links, never both"), so either call proves the
// stories were surfaced to the user.
test('previews the stories', () => {
	expectAnyWorkflowCall(['preview-stories', 'display-review']);
});

// Not part of the original eval: added to track whether agents use the
// documentation tools for the external Reshaped components.
test('uses the documentation tooling', () => {
	expectWorkflowCalls(['get-documentation']);
});
