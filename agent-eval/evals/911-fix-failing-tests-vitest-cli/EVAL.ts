import { expect, test } from 'vitest';
import { getShellCommands, getWorkflowCalls } from '#test-utils';

function usesVitestCli(command: string): boolean {
	return /(^|\s)npx\s+vitest\s+run(\s|$)/.test(command);
}

test('reruns the Vitest CLI after fixing failures', () => {
	expect(getShellCommands().filter(usesVitestCli).length).toBeGreaterThanOrEqual(2);
	expect(getWorkflowCalls('run-story-tests').length).toBe(0);
});
