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
 * Object inputs are compared with deep equality when deciding whether to re-subscribe, so inline
 * literals at the call site are safe.
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
  // `subscriptionKeyRef` (null until the first run) is the initialisation sentinel, not the
  // snapshot value: a query whose output is legitimately `undefined` must not look uninitialised.
  // Compare inputs with `isEqual`, not reference identity, so inline object literals at the
  // call site do not re-run the handler on every render.
  const subscriptionKeyRef = React.useRef<{
    queryFn: Query<TInput, TOutput>;
    input: TInput;
  } | null>(null);
  const snapshotRef = React.useRef<TOutput | undefined>(undefined);

  if (
    subscriptionKeyRef.current === null ||
    subscriptionKeyRef.current.queryFn !== queryFn ||
    !isEqual(subscriptionKeyRef.current.input, input)
  ) {
    subscriptionKeyRef.current = { queryFn, input };
    snapshotRef.current = queryFn(input);
  }

  // Stable for deep-equal inputs — only replaced when `queryFn` or the input value changes.
  const subscriptionKey = subscriptionKeyRef.current!;

  // Re-subscribe when `queryFn` or the input value changes. The service subscribe() fires the
  // callback immediately (deferred to a microtask) with the current value, then again
  // whenever tracked state changes.
  const subscribe = React.useCallback(
    (listener: () => void): (() => void) =>
      queryFn.subscribe(subscriptionKey.input, (value) => {
        if (isEqual(value, snapshotRef.current)) {
          return;
        }
        snapshotRef.current = value;
        listener();
      }),
    [queryFn, subscriptionKey]
  );

  // Read directly from the service to get the freshest synchronous value, but compare with
  // the previously stored snapshot so React sees a stable reference when the value is
  // deeply equal. This prevents unnecessary re-renders when `getSnapshot` is called outside
  // of a subscriber notification (e.g. on React's concurrent-mode bailout checks).
  const getSnapshot = React.useCallback((): TOutput => {
    const value = queryFn(subscriptionKey.input);
    const previous = snapshotRef.current as TOutput;

    if (isEqual(value, previous)) {
      return previous;
    }

    snapshotRef.current = value;
    return value;
  }, [queryFn, subscriptionKey]);

  return React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
