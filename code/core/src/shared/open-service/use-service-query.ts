/**
 * React hook to subscribe to a service query with fine-grained reactivity.
 *
 * Backed by `useSyncExternalStore`, so it integrates correctly with React 18+ concurrent
 * features and works in both manager and preview contexts without any adapter.
 *
 * Re-renders only when the specific query result changes by value. Signal-level dedup
 * inside the service runtime ensures that a load which rewrites a deeply-equal payload does
 * not re-fire the subscription; `isEqual` in `getSnapshot` provides an additional
 * referential-stability layer at the React boundary so the component sees a stable object
 * reference across snapshot reads that return the same logical value.
 *
 * **Memoize complex inputs at the call site.** The input participates in the hook's React
 * dependency array. Passing a new object literal on every render recreates the subscription
 * each render. Wrap object inputs in `useMemo` or extract them to module scope.
 */

import * as React from 'react';

import { isEqual } from 'es-toolkit/predicate';

import type { Query } from './types.ts';

type QueryInput<TQuery> = TQuery extends Query<infer TInput, any> ? TInput : never;
type QueryOutput<TQuery> = TQuery extends Query<any, infer TOutput> ? TOutput : never;

/**
 * Subscribe to a service query and receive reactive updates in a React component.
 *
 * @param service - A service instance from `registerService`.
 * @param queryName - The name of the query to subscribe to.
 * @param args - The query input. Omit entirely for queries whose input type is `void`.
 *
 * @example
 * ```tsx
 * const fields = useServiceQuery(recordService, 'getRecordFields', { entryId: 'a' });
 * ```
 */
export function useServiceQuery<
  // Accept any concretely-typed service: an object-input query (`Query<{ id }, ...>`) is not
  // assignable to `Query<unknown, unknown>` under contravariance, so a `Pick<RuntimeService>`
  // constraint would reject every service whose query takes an object input.
  TInstance extends { queries: Record<string, Query<any, any>> },
  TKey extends keyof TInstance['queries'] & string,
>(
  service: TInstance,
  queryName: TKey,
  ...args: [QueryInput<TInstance['queries'][TKey]>] extends [void]
    ? []
    : [input: QueryInput<TInstance['queries'][TKey]>]
): QueryOutput<TInstance['queries'][TKey]> {
  type TInput = QueryInput<TInstance['queries'][TKey]>;
  type TOutput = QueryOutput<TInstance['queries'][TKey]>;

  const queryFn = service.queries[queryName] as unknown as Query<TInput, TOutput>;
  const input = args[0] as TInput;

  // Initialise synchronously so `getSnapshot` always returns a value on the first render,
  // before the service's async first-emission microtask fires. Lazy-init avoids calling
  // `queryFn(input)` on every render — only when the ref is empty or the subscription changes.
  // Compare inputs with `isEqual`, not reference identity, so inline object literals at the
  // call site do not re-run the handler on every render.
  const subscriptionKeyRef = React.useRef<{
    queryFn: Query<TInput, TOutput>;
    input: TInput;
  } | null>(null);
  const snapshotRef = React.useRef<TOutput | undefined>(undefined);

  if (
    snapshotRef.current === undefined ||
    subscriptionKeyRef.current?.queryFn !== queryFn ||
    !isEqual(subscriptionKeyRef.current?.input, input)
  ) {
    subscriptionKeyRef.current = { queryFn, input };
    snapshotRef.current = queryFn(input);
  }

  // Re-subscribe when `queryFn` or `input` changes. The service subscribe() fires the
  // callback immediately (deferred to a microtask) with the current value, then again
  // whenever tracked state changes.
  const subscribe = React.useCallback(
    (listener: () => void): (() => void) =>
      queryFn.subscribe(input, (value) => {
        snapshotRef.current = value;
        listener();
      }),
    [queryFn, input]
  );

  // Read directly from the service to get the freshest synchronous value, but compare with
  // the previously stored snapshot so React sees a stable reference when the value is
  // deeply equal. This prevents unnecessary re-renders when `getSnapshot` is called outside
  // of a subscriber notification (e.g. on React's concurrent-mode bailout checks).
  const getSnapshot = React.useCallback((): TOutput => {
    const value = queryFn(input);
    const previous = snapshotRef.current as TOutput;

    if (isEqual(value, previous)) {
      return previous;
    }

    snapshotRef.current = value;
    return value;
  }, [queryFn, input]);

  return React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
