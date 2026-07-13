/**
 * React hook to subscribe to a service query with fine-grained reactivity.
 *
 * Backed by React's `useSyncExternalStore`, so it integrates correctly with React 18+ concurrent
 * features. Manager-only: that hook does not exist before React 18, and the preview must keep
 * supporting React 16/17, so preview docs blocks use the shim-based `useQuerySubscription` instead.
 *
 * Returns a {@link QueryState}: the current `data` plus the `load` lifecycle (`status`,
 * `loadStatus`, `error`, and the derived booleans). Re-renders whenever the subscribed query emits
 * (the runtime already dedupes deeply-equal emissions, so the hook does not). Object inputs are
 * compared with deep equality when deciding whether to re-subscribe, so inline literals at the call
 * site are safe; selectors are compared by reference, so memoize them (`useCallback` / module
 * scope) to avoid re-subscribing every render.
 */

import * as React from 'react';

import { isEqual } from 'es-toolkit/predicate';

import { seedQueryState } from './query-state.ts';
import type { Query, QueryState } from './types.ts';

/**
 * Subscribe to a service query and receive reactive {@link QueryState} updates in a React component.
 *
 * Pass the query directly (e.g. `myService.queries.thing`) so its input/output types infer per
 * query. The service must exist: if it may be absent (e.g. behind a feature flag), guard at a parent
 * and conditionally render the component that calls this hook.
 *
 * A void-input query needs no input argument. As soon as a selector is involved the input is
 * positional, so a void-input query passes `undefined` explicitly:
 * `useServiceQuery(query, undefined, selector)`.
 *
 * @example
 * ```tsx
 * const { data, isInitialLoading, isError } = useServiceQuery(recordService.queries.recordFields, {
 *   entryId: 'a',
 * });
 * ```
 */
export function useServiceQuery<TOutput>(query: Query<void, TOutput>): QueryState<TOutput>;
export function useServiceQuery<TInput, TOutput>(
  query: Query<TInput, TOutput>,
  input: TInput
): QueryState<TOutput>;
export function useServiceQuery<TInput, TOutput, TSelected>(
  query: Query<TInput, TOutput>,
  input: TInput,
  selector: (value: TOutput) => TSelected
): QueryState<TSelected>;
export function useServiceQuery(
  query: Query<unknown, unknown>,
  input?: unknown,
  selector?: (value: unknown) => unknown
): QueryState<unknown> {
  // The first render is seeded synchronously: `useSyncExternalStore` reads `getSnapshot` during
  // render but only runs `subscribe` in a post-paint passive effect, so a snapshot must already
  // exist. We read the current data with `query.get(input)` (a pure read that fires no load) and
  // wrap it in a synthetic `pending` state; the real lifecycle arrives moments later from the
  // subscription's first emission. The seed is recomputed only when the subscription key changes:
  // `query`/`selector` by reference and `input` by deep equality (so inline object literals are
  // safe). `subscriptionKeyRef` is null until the first run — the init sentinel, not the snapshot.
  const subscriptionKeyRef = React.useRef<{
    query: Query<unknown, unknown>;
    input: unknown;
    selector: ((value: unknown) => unknown) | undefined;
  } | null>(null);
  const snapshotRef = React.useRef<QueryState<unknown> | undefined>(undefined);

  if (
    subscriptionKeyRef.current === null ||
    subscriptionKeyRef.current.query !== query ||
    !isEqual(subscriptionKeyRef.current.input, input) ||
    subscriptionKeyRef.current.selector !== selector
  ) {
    subscriptionKeyRef.current = { query, input, selector };
    snapshotRef.current = selector
      ? seedQueryState(query, input, selector)
      : seedQueryState(query, input);
  }

  // Stable for deep-equal inputs — only replaced when the query, input value, or selector changes.
  const subscriptionKey = subscriptionKeyRef.current!;

  const subscribe = React.useCallback(
    (listener: () => void): (() => void) => {
      const { query: q, input: i, selector: s } = subscriptionKey;
      const onQueryState = (queryState: QueryState<unknown>) => {
        snapshotRef.current = queryState;
        listener();
      };
      return s ? q.subscribe(i, s, onQueryState) : q.subscribe(i, onQueryState);
    },
    [subscriptionKey]
  );

  // React may call getSnapshot multiple times during render/bailout checks, so it must be a pure
  // ref read rather than recomputing the seed (which would re-run the handler) on every call.
  const getSnapshot = React.useCallback((): QueryState<unknown> => {
    return snapshotRef.current as QueryState<unknown>;
  }, []);

  // Only runs in manager, so React 18 is available.
  return React.useSyncExternalStore(subscribe, getSnapshot);
}
