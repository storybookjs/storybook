import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getAct, getReactActEnvironment, setReactActEnvironment } from './act-compat.ts';

// Regression test for https://github.com/storybookjs/storybook/issues/34708.
//
// `withGlobalActEnvironment` used to restore `IS_REACT_ACT_ENVIRONMENT` only
// when a caller invoked the returned thenable's `.then`. Pipeline callers that
// discard the result without awaiting it (e.g. the testing-library
// `eventWrapper`, async teardown) therefore left the flag stuck `true`, leaking
// across story boundaries and producing spurious React
// "act(async () => ...) without await" warnings in multi-file Vitest
// browser-mode runs. The flag must be restored once the act work settles,
// independent of whether the caller awaits the result.
describe('act-compat', () => {
  let errors: string[] = [];

  beforeEach(() => {
    errors = [];
    setReactActEnvironment(false);
    vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      errors.push(args.map((arg) => String(arg)).join(' '));
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('restores the act environment and does not warn for an un-awaited async act', async () => {
    const act = await getAct();

    // Trigger an async act but never await the returned thenable, mimicking a
    // pipeline caller that discards the result.
    void (act(async () => {
      await Promise.resolve();
    }) as unknown as Promise<unknown>);

    // The flag is set synchronously while act is in progress.
    expect(getReactActEnvironment()).toBe(true);

    // Let the act work and React's deferred await-tracking check settle without
    // the caller ever awaiting the thenable.
    await new Promise((resolve) => setTimeout(resolve, 0));

    const actWarnings = errors.filter((error) =>
      error.includes('You called act(async () => ...) without await')
    );

    expect(getReactActEnvironment()).toBe(false);
    expect(actWarnings).toEqual([]);
  });

  it('restores the act environment after an awaited async act resolves', async () => {
    const act = await getAct();

    await act(async () => {
      await Promise.resolve();
    });

    expect(getReactActEnvironment()).toBe(false);
  });

  it('restores the act environment after an awaited async act rejects', async () => {
    const act = await getAct();

    await expect(
      act(async () => {
        throw new Error('boom');
      })
    ).rejects.toThrow('boom');

    expect(getReactActEnvironment()).toBe(false);
  });
});
