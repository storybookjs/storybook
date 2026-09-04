import { expectFinalResponseContains, expectWorkflowCalls, getEvalContext } from '#test-utils';
import { describe, test } from 'vitest';

describe('answering which props ReviewCard accepts', () => {
  // Skipped for Claude Code+MCP: answers props questions via find+Read on
  // source and never calls MCP docs tools (0/4 runs), even with the docs-question
  // rule first in server instructions and tool descriptions. Codex+MCP passes
  // on the same channels, so this is a Claude Code gap on question-shaped
  // tasks, not a steering bug. Seen in CI 28660377980 plus three local rounds
  // on 2026-07-03. Re-enable when Claude Code question tasks reliably use MCP.
  const { agent, integration } = getEvalContext();
  const claudeCodeMcp = agent === 'claude-code' && integration === 'mcp';

  test.skipIf(claudeCodeMcp)('uses the documentation tooling to resolve props and usage', () => {
    expectWorkflowCalls(['docs-list', 'docs-show']);
  });

  // The fixture component has exactly these three props; a grounded answer
  // names all of them.
  test('the answer covers every ReviewCard prop', () => {
    expectFinalResponseContains(['author', 'rating', 'comment']);
  });
});
