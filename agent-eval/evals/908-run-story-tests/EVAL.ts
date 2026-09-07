import { describe, test } from 'vitest';
import { expectWorkflowCalls } from '#test-utils';

describe('running Button story tests via the Storybook testing tool', () => {
  test('runs Storybook story tests', () => {
    expectWorkflowCalls(['test-run']);
  });
});
