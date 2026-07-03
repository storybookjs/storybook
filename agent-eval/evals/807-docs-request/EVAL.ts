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

// On the review-on instructions MCP-path agents consistently bypassed the
// docs tools (2026-07-02 full-grid run: 0/2 on cc-mcp and codex-mcp, while
// both plugin experiments passed) — that gate stays for review-on runs until
// the instruction steering lands (storybookjs/mcp#315, slimming in #320).
// Review-off runs (the default) assert every integration: the restored
// legacy instructions are untruncated and are the last known working state
// for docs-tool usage, which restoring them is meant to prove.
const { integration } = getEvalContext();
const review = isReviewEnabled();

test.skipIf(review && integration === 'mcp')(
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
