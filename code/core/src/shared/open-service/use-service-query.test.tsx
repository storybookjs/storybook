// @vitest-environment happy-dom
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clearChannel, installNoopChannel } from '../../channels/channel-slot.ts';

import {
  awaitedPreloadValueServiceDef,
  mutableRecordLookupServiceDef,
  undefinedOutputQueryServiceDef,
} from './fixtures.ts';
import { clearRegistry, registerService } from './service-registry.ts';
import type { Query, QueryState } from './types.ts';
import { useServiceQuery } from './use-service-query.ts';

beforeEach(() => {
  installNoopChannel();
});

afterEach(() => {
  clearRegistry();
  clearChannel();
});

describe('useServiceQuery', () => {
  it('returns the initial synchronous query result as data', () => {
    const service = registerService(mutableRecordLookupServiceDef);

    const { result } = renderHook(() =>
      useServiceQuery(service.queries.getRecordFields, { entryId: 'a' })
    );

    expect(result.current.data).toBeNull();
    expect(result.current.isError).toBe(false);
  });

  it('shows pending with the synchronous get() data while a load-backed query loads', async () => {
    const service = registerService(awaitedPreloadValueServiceDef);

    const { result } = renderHook(() =>
      useServiceQuery(service.queries.getPreloadedValue, { entryId: 'a' })
    );

    // A load-backed query stays `pending` until its load settles. `data` is the synchronous
    // `get()` value (null here, before the load has populated state).
    expect(result.current.status).toBe('pending');
    expect(result.current.isPending).toBe(true);
    expect(result.current.data).toBeNull();

    await waitFor(() => expect(result.current.data).toBe('preloaded'));
  });

  it('re-renders when the query result changes after a command', async () => {
    const service = registerService(mutableRecordLookupServiceDef);

    const { result } = renderHook(() =>
      useServiceQuery(service.queries.getRecordFields, { entryId: 'a' })
    );

    expect(result.current.data).toBeNull();

    await service.commands.assignRecordField({
      entryId: 'a',
      fieldKey: 'color',
      fieldValue: 'red',
    });

    await waitFor(() => {
      expect(result.current.data).toEqual({ color: 'red' });
    });
  });

  it('does not re-render for an unrelated entry', async () => {
    const service = registerService(mutableRecordLookupServiceDef);
    let renderCount = 0;

    renderHook(() => {
      renderCount++;
      return useServiceQuery(service.queries.getRecordFields, { entryId: 'a' });
    });

    const countAfterMount = renderCount;

    await service.commands.assignRecordField({
      entryId: 'b',
      fieldKey: 'other',
      fieldValue: 'value',
    });

    // Wait a tick to let any spurious re-renders fire.
    await new Promise<void>((resolve) => setTimeout(resolve, 20));

    // No re-render because the subscribed key ('a') was not affected.
    expect(renderCount).toBe(countAfterMount);
  });

  it('updates when input changes', async () => {
    const service = registerService(mutableRecordLookupServiceDef);

    await service.commands.assignRecordField({
      entryId: 'a',
      fieldKey: 'k',
      fieldValue: 'v',
    });

    let currentEntryId = 'b';
    const { result, rerender } = renderHook(() =>
      useServiceQuery(service.queries.getRecordFields, { entryId: currentEntryId })
    );

    expect(result.current.data).toBeNull();

    currentEntryId = 'a';
    rerender();

    expect(result.current.data).toEqual({ k: 'v' });
  });

  it('accumulates incremental updates', async () => {
    const service = registerService(mutableRecordLookupServiceDef);

    const { result } = renderHook(() =>
      useServiceQuery(service.queries.getRecordFields, { entryId: 'a' })
    );

    await service.commands.assignRecordField({ entryId: 'a', fieldKey: 'x', fieldValue: '1' });

    await waitFor(() => {
      expect(result.current.data).toEqual({ x: '1' });
    });

    await service.commands.assignRecordField({ entryId: 'a', fieldKey: 'y', fieldValue: '2' });

    await waitFor(() => {
      expect(result.current.data).toEqual({ x: '1', y: '2' });
    });
  });

  it('treats an undefined query output as initialised, not as a recompute sentinel', () => {
    const service = registerService(undefinedOutputQueryServiceDef);
    // Re-subscription happens only when the lazy-init subscription key changes. If `undefined`
    // output were mistaken for "uninitialised", the key would be rebuilt on every render and the
    // hook would resubscribe each time.
    const subscribeSpy = vi.spyOn(service.queries.getNothing, 'subscribe');

    const { result, rerender } = renderHook(() => useServiceQuery(service.queries.getNothing));

    expect(result.current.data).toBeUndefined();

    const subscribeCallsAfterMount = subscribeSpy.mock.calls.length;

    rerender();
    rerender();

    expect(result.current.data).toBeUndefined();
    expect(subscribeSpy.mock.calls.length).toBe(subscribeCallsAfterMount);
  });

  it('re-renders on every emission (no hook-level dedup) and reflects the latest state', async () => {
    const subscribers: Array<(queryState: QueryState<{ k: string }>) => void> = [];
    const successState = (data: { k: string }): QueryState<{ k: string }> => ({
      data,
      error: undefined,
      status: 'success',
      loadStatus: 'idle',
      isPending: false,
      isSuccess: true,
      isError: false,
      isLoading: false,
      isInitialLoading: false,
      isRefreshing: false,
    });
    const getRecordFields = {
      get: vi.fn(() => ({ k: 'v' })),
      subscribe: vi.fn(
        (
          _input: { entryId: string },
          callback: (queryState: QueryState<{ k: string }>) => void
        ) => {
          subscribers.push(callback);
          return () => {};
        }
      ),
    } as unknown as Query<{ entryId: string }, { k: string }>;

    let renderCount = 0;
    const { result } = renderHook(() => {
      renderCount++;
      return useServiceQuery(getRecordFields, { entryId: 'a' });
    });

    // The first render is the synthetic `pending` seed built from `get()`.
    expect(result.current.isPending).toBe(true);
    expect(result.current.data).toEqual({ k: 'v' });

    await waitFor(() => expect(subscribers).toHaveLength(1));

    // The first real emission transitions the seed (`pending`) to `success`, so it re-renders.
    const countBeforeSuccess = renderCount;
    subscribers[0](successState({ k: 'v' }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(renderCount).toBe(countBeforeSuccess + 1);

    // The hook does not dedup: even a new-reference, deeply-equal emission re-renders. (The runtime
    // dedups its own emissions; the hook deliberately trusts that rather than re-checking equality,
    // which previously masked mutations of deeply-nested state.)
    const countAfterSuccess = renderCount;
    subscribers[0](successState({ k: 'v' }));
    await waitFor(() => expect(renderCount).toBe(countAfterSuccess + 1));

    // A genuinely different state is reflected too.
    subscribers[0](successState({ k: 'changed' }));
    await waitFor(() => expect(result.current.data).toEqual({ k: 'changed' }));
    expect(renderCount).toBe(countAfterSuccess + 2);
  });
});
