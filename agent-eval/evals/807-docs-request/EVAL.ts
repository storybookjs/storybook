import { test } from 'vitest';
import { expectFinalResponseContains, expectWorkflowCalls } from '#test-utils';

// Documentation request: a props/usage question about an existing component
// must be answered through the documentation tools, grounded in the live
// Storybook index (list-all-documentation for IDs, get-documentation for
// props and usage), not by grepping component source and guessing.

// The MCP-integration gate is gone since storybookjs/mcp#320: review-off
// ships the restored legacy instructions (untruncated, last known working
// state), and review-on ships this PR's slim instructions, which survive
// Claude Code's 2,048-char truncation so the docs workflow reaches MCP-path
// agents again — 4/4 configs green in the 2026-07-02 dispatch run (see
// storybookjs/mcp#315 for the pre-fix 0/2 runs).
test('uses the documentation tooling to resolve props and usage', () => {
	expectWorkflowCalls(['list-all-documentation', 'get-documentation']);
});

// The fixture component has exactly these three props; a grounded answer
// names all of them.
test('the answer covers every ReviewCard prop', () => {
	expectFinalResponseContains(['author', 'rating', 'comment']);
});
