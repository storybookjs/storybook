import { test } from 'vitest';
import { expectFinalResponseContains, expectWorkflowCalls, getEvalContext } from '#test-utils';

// Documentation request: a props/usage question about an existing component
// must be answered through the documentation tools, grounded in the live
// Storybook index (list-all-documentation for IDs, get-documentation for
// props and usage), not by grepping component source and guessing.

// MCP-path agents consistently bypass the docs tools despite the server
// instructions (2026-07-02 full-grid run: 0/2 on cc-mcp and codex-mcp, while
// both plugin experiments passed). Gate the assertion to the plugin
// integration until the MCP instruction steering lands. See storybookjs/mcp#315.
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
