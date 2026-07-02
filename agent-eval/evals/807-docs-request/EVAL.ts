import { test } from 'vitest';
import { expectFinalResponseContains, expectWorkflowCalls } from '#test-utils';

// Documentation request: a props/usage question about an existing component
// must be answered through the documentation tools, grounded in the live
// Storybook index (list-all-documentation for IDs, get-documentation for
// props and usage), not by grepping component source and guessing.

test('uses the documentation tooling to resolve props and usage', () => {
	expectWorkflowCalls(['list-all-documentation', 'get-documentation']);
});

// The fixture component has exactly these three props; a grounded answer
// names all of them.
test('the answer covers every ReviewCard prop', () => {
	expectFinalResponseContains(['author', 'rating', 'comment']);
});
