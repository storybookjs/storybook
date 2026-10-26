import { describe, expect, test } from 'vitest';
import { expectWorkflowCalls, getShellCommands, getWorkflowCalls } from '#test-utils';

describe('fixing failing Button tests via the Vitest CLI and previewing the stories', () => {
  function usesVitestCli(command: string): boolean {
    return /(^|\s)npx\s+vitest\s+run(\s|$)/.test(command);
  }

  test('reruns the Vitest CLI after fixing failures', () => {
    expect(getShellCommands().filter(usesVitestCli).length).toBeGreaterThanOrEqual(2);
    expect(getWorkflowCalls('test-run').length).toBe(0);
    expectWorkflowCalls(['stories-preview']);
  });
});
