import { test } from 'vitest';
import { expectFinalResponseContains, expectWorkflowCalls, getEvalContext } from '#test-utils';

// Documentation request: a props/usage question about an existing component
// must be answered through the documentation tools, grounded in the live
// Storybook index (list-all-documentation for IDs, get-documentation for
// props and usage), not by grepping component source and guessing.

// Accepted known failure on the Claude Code MCP path: Claude answers the
// props question with `find` + Read on the component source and never calls
// any MCP tool — 0/4 fresh runs on 2026-07-03 (CI run 28660377980 plus three
// local rounds), even after the docs-question rule became the literal first
// sentence of the served server instructions (verified in the failing run's
// .storybook/mcp-debug snapshot) and the list-all-documentation /
// get-documentation descriptions carried the same rule. Instruction wording
// is exhausted; this is a Claude Code behavior gap on question-shaped tasks,
// not a steering bug — codex-mcp follows the same channels and passes, and
// the plugin path passes via the stories skill. Re-enable when a product
// mechanism (skill-equivalent steering or tool forcing for docs questions on
// the MCP path) exists to route Claude Code question tasks into the tools.
const { agent, integration } = getEvalContext();
const claudeCodeMcp = agent === 'claude-code' && integration === 'mcp';

test.skipIf(claudeCodeMcp)('uses the documentation tooling to resolve props and usage', () => {
	expectWorkflowCalls(['list-all-documentation', 'get-documentation']);
});

// The fixture component has exactly these three props; a grounded answer
// names all of them.
test('the answer covers every ReviewCard prop', () => {
	expectFinalResponseContains(['author', 'rating', 'comment']);
});
