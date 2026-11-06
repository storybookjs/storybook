import { expect, it } from 'vitest';

it('fails on purpose to check how the CircleCI NX pipeline reports a failed task', () => {
  expect('the answer').toBe('a deliberate failure');
});
