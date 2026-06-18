import { useEffect, useReducer, useRef } from 'react';

import { type Query, type QueryState, seedQueryState } from 'storybook/open-service';

/**
 * React 16/17-safe subscription to a single open-service query, shared by the preview-side docs
 * hooks.
 *
 * Deliberately does NOT reuse the manager-side `useServiceQuery`: that hook is built on
 * `useSyncExternalStore`, which only exists in React 18+, while the preview docs blocks must keep
 * working on React 16/17. This is a small, query-specific subscription instead:
 *
 * - the current {@link QueryState} is seeded synchronously during render (via `seedQueryState`, a
 *   pure `.get()` read wrapped in a synthetic `pending` state) so switching subjects never lags a
 *   frame, and
 * - the subscription forces a re-render whenever the query emits a new {@link QueryState}.
 *
 * `cacheKey` must uniquely identify the `(input, selector)` pair: it gates both the synchronous
 * re-seed and the effect's re-subscription. `input`/`selector` are read through refs so the effect's
 * dependency list stays on the stable `cacheKey` rather than per-render object/closure identities.
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
  const [, forceRender] = useReducer((tick: number) => tick + 1, 0);
  const cache = useRef<{ key: string; state: QueryState<TOutput | TSelected> }>(undefined);

  if (cache.current?.key !== cacheKey) {
    cache.current = {
      key: cacheKey,
      state: selector ? seedQueryState(query, input, selector) : seedQueryState(query, input),
    };
  }

  const inputRef = useRef(input);
  const selectorRef = useRef(selector);
  inputRef.current = input;
  selectorRef.current = selector;

  useEffect(() => {
    const onState = (state: QueryState<TOutput | TSelected>) => {
      cache.current = { key: cacheKey, state };
      forceRender();
    };
    const currentSelector = selectorRef.current;
    return currentSelector
      ? query.subscribe(inputRef.current, currentSelector, onState)
      : query.subscribe(inputRef.current, onState);
    // `cacheKey` encodes the (input, selector) identity; the refs supply their freshest values.
  }, [query, cacheKey]);

  return cache.current.state;
}
