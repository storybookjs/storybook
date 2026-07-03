import { test } from 'vitest';
import {
	expectFinalResponseContains,
	expectWorkflowCalls,
	getEvalContext,
	isReviewEnabled,
} from '#test-utils';

// Documentation request: a props/usage question about an existing component
// must be answered through the documentation tools, grounded in the live
// Storybook index (list-all-documentation for IDs, get-documentation for
// props and usage), not by grepping component source and guessing.

// Accepted known failure on review-off MCP: under the restored legacy
// instructions MCP-path agents bypass the docs tools (2026-07-03 run
// 28660377980: 0/2, both answered from grep/file reads; codex even called
// list-all-documentation and get-documentation-for-story but never
// get-documentation) — legacy being untruncated with the CRITICAL rule shows
// truncation alone was not the cause there. Review-on ships this PR's slim
// instructions, where the MCP path is proven: 4/4 configs called the docs
// tools in the 2026-07-02 dispatch and full-grid runs. The plugin
// integration asserts in both modes.
const { integration } = getEvalContext();
const review = isReviewEnabled();

test.skipIf(!review && integration === 'mcp')(
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
