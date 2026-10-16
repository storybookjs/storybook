import { useCallback, useRef } from 'react';

import { type Query, type QueryState, seedQueryState } from 'storybook/open-service';

import { useSyncExternalStoreShim } from './useSyncExternalStoreShim.ts';

/**
 * React 16/17-safe subscription to a single open-service query, shared by the preview-side docs
 * hooks.
 *
 * Deliberately does NOT reuse the manager-side `useServiceQuery`: that hook is built on React's
 * `useSyncExternalStore`, which only exists in React 18+, while the preview docs blocks must keep
 * working on React 16/17. It is instead built on {@link useSyncExternalStoreShim} (the React 16-safe
 * port of that hook), adding the open-service specifics:
 *
 * - the current {@link QueryState} is seeded synchronously during render (via `seedQueryState`, a
 *   pure `.get()` read wrapped in a synthetic `pending` state) so switching subjects never lags a
 *   frame, and
 * - the subscription re-renders whenever the query emits a new {@link QueryState}.
 *
 * `cacheKey` must uniquely identify the `input` (a stringifiable identity for the value the query is
 * read with); it gates the synchronous re-seed and re-subscription. `input` itself is read through a
 * ref so an inline object literal that is structurally stable under one `cacheKey` does not force a
 * re-subscribe every render. A `selector` cannot be folded into a string key, so it is tracked by
 * reference as a real dependency: changing it re-seeds and re-subscribes so the selected slice can
 * never lag behind the current selector.
 */
export function useQuerySubscription<TInput, TOutput>(
  cacheKey: string,
  query: Query<TInput, TOutput>,
  input: TInput
): QueryState<TOutput>;
export function useQuerySubscription<TInput, TOutput, TSelected>(
  cacheKey: string,
  query: Query<TInput, TOutput>,
  input: TInput,
  selector: (value: TOutput) => TSelected
): QueryState<TSelected>;
export function useQuerySubscription<TInput, TOutput, TSelected>(
  cacheKey: string,
  query: Query<TInput, TOutput>,
  input: TInput,
  selector?: (value: TOutput) => TSelected
): QueryState<TOutput | TSelected> {
  const cache = useRef<{
    key: string;
    selector: ((value: TOutput) => TSelected) | undefined;
    state: QueryState<TOutput | TSelected>;
  }>(undefined);

  if (cache.current?.key !== cacheKey || cache.current.selector !== selector) {
    cache.current = {
      key: cacheKey,
      selector,
      state: selector ? seedQueryState(query, input, selector) : seedQueryState(query, input),
    };
  }

  const inputRef = useRef(input);
  inputRef.current = input;

  // Re-subscribe only when the query, input identity (`cacheKey`), or `selector` changes; `input`
  // stays in a ref so its per-render object identity does not re-subscribe under a stable key.
  const subscribe = useCallback(
    (listener: () => void): (() => void) => {
      const onQueryState = (state: QueryState<TOutput | TSelected>) => {
        cache.current = { key: cacheKey, selector, state };
        listener();
      };
      return selector
        ? query.subscribe(inputRef.current, selector, onQueryState)
        : query.subscribe(inputRef.current, onQueryState);
    },
    [query, cacheKey, selector]
  );

  // Pure ref read: the shim calls this during render and to detect emitted changes, so it must not
  // recompute the seed (which would re-run the query handler).
  const getSnapshot = useCallback((): QueryState<TOutput | TSelected> => cache.current!.state, []);

  return useSyncExternalStoreShim(subscribe, getSnapshot);
}
