import { describe, expect, test } from 'vitest';
import { expectWorkflowCalls, getWorkflowCalls, type StorybookWorkflowCall } from '#test-utils';

describe('running Button story tests with a11y disabled via an explicit prompt', () => {
  function disablesA11y(call: StorybookWorkflowCall): boolean {
    return call.input.a11y === false;
  }

  test('runs Storybook story tests with a11y disabled', () => {
    expectWorkflowCalls(['test-run']);
    expect(getWorkflowCalls('test-run').some(disablesA11y)).toBe(true);
  });
});
