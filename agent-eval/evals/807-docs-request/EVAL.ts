import { test } from 'vitest';
import { expectFinalResponseContains, expectWorkflowCalls } from '#test-utils';

// Documentation request: a props/usage question about an existing component
// must be answered through the documentation tools, grounded in the live
// Storybook index (list-all-documentation for IDs, get-documentation for
// props and usage), not by grepping component source and guessing.

// The MCP-integration gate is gone since storybookjs/mcp#320: the server
// instructions survive Claude Code's 2,048-char truncation and the docs
// workflow now reaches MCP-path agents (see storybookjs/mcp#315 for the
// pre-fix 0/2 runs).
test('uses the documentation tooling to resolve props and usage', () => {
	expectWorkflowCalls(['list-all-documentation', 'get-documentation']);
});

// The fixture component has exactly these three props; a grounded answer
// names all of them.
test('the answer covers every ReviewCard prop', () => {
	expectFinalResponseContains(['author', 'rating', 'comment']);
});
