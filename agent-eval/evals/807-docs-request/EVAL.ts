import { test } from 'vitest';
import { expectFinalResponseContains, expectWorkflowCalls, getEvalContext } from '#test-utils';

// Documentation request: a props/usage question about an existing component
// must be answered through the documentation tools, grounded in the live
// Storybook index (list-all-documentation for IDs, get-documentation for
// props and usage), not by grepping component source and guessing.

// Accepted known failure — MCP-path agents bypass the docs tools regardless
// of instruction shape: 0/2 on cc-mcp and codex-mcp under the review-on
// instructions (2026-07-02 full-grid run), and still
// 0/2 under the restored untruncated legacy instructions with the CRITICAL
// never-hallucinate rule (2026-07-03 run 28660377980: both answered from
// grep/file reads; codex even called list-all-documentation and
// get-documentation-for-story but never get-documentation). Truncation was
// therefore not the cause — MCP docs steering needs its own fix. Gated to
// the plugin integration in both review modes.
const { integration } = getEvalContext();

test.skipIf(integration === 'mcp')(
	'uses the documentation tooling to resolve props and usage',
	() => {
		expectWorkflowCalls(['list-all-documentation', 'get-documentation']);
	},
);

// The fixture component has exactly these three props; a grounded answer
// names all of them.
test('the answer covers every ReviewCard prop', () => {
	expectFinalResponseContains(['author', 'rating', 'comment']);
});
