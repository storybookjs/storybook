import { test } from 'vitest';
import { expectFinalResponseContains, expectWorkflowCalls } from '#test-utils';

// Documentation request: a props/usage question about an existing component
// must be answered through the documentation tools, grounded in the live
// Storybook index (list-all-documentation for IDs, get-documentation for
// props and usage), not by grepping component source and guessing.

// MCP-path agents used to bypass the docs tools regardless of instruction
// shape: 0/2 on cc-mcp and codex-mcp under both the review-on instructions
// (2026-07-02 full-grid run, storybookjs/mcp#315) and the restored legacy
// instructions (2026-07-03 run 28660377980: both answered from grep/file
// reads). The docs instructions and tool descriptions now say explicitly
// that props/usage *questions* must be answered from these tools and that
// reading component source is not a substitute — this asserts that steering
// works on every integration.
test('uses the documentation tooling to resolve props and usage', () => {
	expectWorkflowCalls(['list-all-documentation', 'get-documentation']);
});

// The fixture component has exactly these three props; a grounded answer
// names all of them.
test('the answer covers every ReviewCard prop', () => {
	expectFinalResponseContains(['author', 'rating', 'comment']);
});
