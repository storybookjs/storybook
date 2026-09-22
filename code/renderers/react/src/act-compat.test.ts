import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getAct, getReactActEnvironment, setReactActEnvironment } from './act-compat.ts';

// Top-level module mocks. `react` keeps its real exports, but the fallback test
// can hide `act` (via the hoisted flag, so it's available to the hoisted mock
// factory) to route getAct onto the deprecated react-dom/test-utils branch.
const mockState = vi.hoisted(() => ({ reactExposesAct: true }));

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    get act() {
      return mockState.reactExposesAct ? actual.act : undefined;
    },
  };
});

vi.mock('react-dom/test-utils', { spy: true });

// Regression coverage for https://github.com/storybookjs/storybook/issues/34708:
// `IS_REACT_ACT_ENVIRONMENT` must be restored once the act work settles (so it
// can't leak `true` across story boundaries) and stay set while concurrent acts
// overlap. A stuck flag makes React log "act(async () => ...) without await".
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
    mockState.reactExposesAct = true;
  });

  describe('restores the environment once the act settles', () => {
    it('after an un-awaited async act, without warning', async () => {
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

    it('after an awaited async act resolves', async () => {
      const act = await getAct();

      await act(async () => {
        await Promise.resolve();
      });

      expect(getReactActEnvironment()).toBe(false);
    });

    it('after an awaited async act rejects', async () => {
      const act = await getAct();

      await expect(
        act(async () => {
          throw new Error('boom');
        })
      ).rejects.toThrow('boom');

      expect(getReactActEnvironment()).toBe(false);
    });

    it('after a synchronous act callback', async () => {
      const act = await getAct();

      act(() => {
        expect(getReactActEnvironment()).toBe(true);
      });

      expect(getReactActEnvironment()).toBe(false);
    });

    it('after a synchronous act callback throws', async () => {
      const act = await getAct();

      expect(() =>
        act(() => {
          throw new Error('boom');
        })
      ).toThrow('boom');

      expect(getReactActEnvironment()).toBe(false);
    });
  });

  describe('ref-counts across overlapping acts', () => {
    it('stays set until every interleaved act has settled', async () => {
      const act = await getAct();

      let resolveFirst: () => void = () => {};
      let resolveSecond: () => void = () => {};

      const first = act(() => new Promise<void>((resolve) => (resolveFirst = resolve)));
      const second = act(() => new Promise<void>((resolve) => (resolveSecond = resolve)));

      expect(getReactActEnvironment()).toBe(true);

      resolveFirst();
      await first;

      // The second act is still in flight, so the flag must remain set.
      expect(getReactActEnvironment()).toBe(true);

      resolveSecond();
      await second;

      expect(getReactActEnvironment()).toBe(false);
    });

    it('restores the pre-existing value when a nested act settles', async () => {
      const act = await getAct();

      // An outer act already enabled the environment; the nested act must leave
      // it enabled rather than hardcode it back to `false`.
      setReactActEnvironment(true);

      await act(async () => {
        expect(getReactActEnvironment()).toBe(true);
        await Promise.resolve();
      });

      expect(getReactActEnvironment()).toBe(true);
    });
  });

  describe('getAct resolution', () => {
    it('returns a no-op that leaves the environment untouched when act is disabled', async () => {
      const act = await getAct({ disableAct: true });

      let called = false;
      act(() => {
        called = true;
        expect(getReactActEnvironment()).toBe(false);
      });

      expect(called).toBe(true);
      expect(getReactActEnvironment()).toBe(false);
    });

    it('falls back to react-dom/test-utils when React.act is unavailable', async () => {
      // Hide `act` on the mocked react so getAct takes the fallback branch, then
      // re-evaluate act-compat (it snapshots `{ ...React }` at module load).
      mockState.reactExposesAct = false;
      vi.resetModules();

      const { getAct: getActFresh } = await import('./act-compat.ts');
      const testUtils = await import('react-dom/test-utils');
      const act = await getActFresh();

      act(() => {});

      expect(vi.mocked(testUtils).act).toHaveBeenCalledOnce();
    });
  });
});
