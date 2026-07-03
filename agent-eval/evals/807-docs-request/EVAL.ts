import { test } from 'vitest';
import { expectFinalResponseContains, expectWorkflowCalls } from '#test-utils';

// Documentation request: a props/usage question about an existing component
// must be answered through the documentation tools, grounded in the live
// Storybook index (list-all-documentation for IDs, get-documentation for
// props and usage), not by grepping component source and guessing.

// MCP-path agents used to bypass the docs tools on pure questions: 0/2 on
// cc-mcp and codex-mcp under the legacy instructions (2026-07-03 run
// 28660377980, both answered from grep/file reads) and 0/2 under the slim
// review-on instructions (2026-07-03 run 28663662412). The docs instructions
// and the get-documentation/list-all-documentation descriptions now say
// explicitly that props/usage *questions* must be answered from these tools
// and that reading component source is not a substitute — this asserts that
// steering works on every integration in both review modes.
test('uses the documentation tooling to resolve props and usage', () => {
	expectWorkflowCalls(['list-all-documentation', 'get-documentation']);
});

// The fixture component has exactly these three props; a grounded answer
// names all of them.
test('the answer covers every ReviewCard prop', () => {
	expectFinalResponseContains(['author', 'rating', 'comment']);
});
