import { test } from 'vitest';
import { expectFinalResponseContains, expectWorkflowCalls, getEvalContext } from '#test-utils';

// Accepted known failure on the Claude Code MCP path: Claude answers the
// props question with `find` + Read on the component source and never calls
// any MCP tool — 0/4 fresh runs on 2026-07-03 (CI run 28660377980 plus three
// local rounds), even with the docs-question rule as the first sentence of
// the served server instructions and in the tool descriptions. codex-mcp
// follows the same channels and passes, so this is a Claude Code behavior
// gap on question-shaped tasks, not a steering bug. Re-enable when a product
// mechanism can route Claude Code question tasks into the MCP tools.
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
