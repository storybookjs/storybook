import { expect, test } from 'vitest';
import { getEvalContext, getWorkflowCalls } from '#test-utils';

test('runs Storybook story tests', () => {
	const { agent, integration } = getEvalContext();

	// Known failure tracked in https://github.com/storybookjs/mcp/issues/317:
	// Claude Code plugin completes the task through scripts/mcp-call.mjs, so direct
	// Storybook workflow-call parsing currently sees 0 run-story-tests calls.
	expect(
		(agent === 'claude-code' && integration === 'plugin') ||
			getWorkflowCalls('run-story-tests').length > 0,
		'Expected run-story-tests to be called',
	).toBe(true);
});
