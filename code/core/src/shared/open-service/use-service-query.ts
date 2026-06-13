/**
 * React hook to subscribe to a service query with fine-grained reactivity.
 *
 * Backed by `useSyncExternalStore`, so it integrates correctly with React 18+ concurrent
 * features and works in both manager and preview contexts without any adapter.
 *
 * Re-renders only when the specific query result changes by value. Signal-level dedup
 * inside the service runtime ensures that a load which rewrites a deeply-equal payload does
 * not re-fire the subscription; `isEqual` in the subscription callback provides an additional
 * referential-stability layer at the React boundary so the component sees a stable object
 * reference across updates that return the same logical value.
 *
 * Object inputs are compared with deep equality when deciding whether to re-subscribe, so inline
 * literals at the call site are safe.
 */

import * as React from 'react';

import { isEqual } from 'es-toolkit/predicate';

import type { Query } from './types.ts';

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
// `TInput`/`TOutput` are inferred as direct type parameters from the query's call signature. This is
// deliberate: a conditional over an indexed access like `Query<TInstance['queries'][TKey]>` is
// evaluated against the index's *constraint* (`Query<any, any>`, which — being `VoidQuery & InputQuery`
// — is callable with zero args and so always looks void), collapsing every query to "no input". Typing
// the query value as a plain `(input: TInput) => TOutput` call signature recovers the concrete input
// and output, and keeps the void-vs-input branch (`[TInput] extends [void]`) over a real type.
export function useServiceQuery<TKey extends string, TInput, TOutput>(
  service: { queries: Record<TKey, (input: TInput) => TOutput> },
  queryName: TKey,
  // A rest parameter so the input can be conditionally present: void-input queries take no third
  // argument, every other query requires exactly one.
  ...args: [TInput] extends [void] ? [] : [input: TInput]
): TOutput {
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

  // React may call getSnapshot multiple times during render/bailout checks, so it must be a pure
  // ref read. Calling the service query here would be observable for queries with load hooks.
  const getSnapshot = React.useCallback((): TOutput => {
    return snapshotRef.current as TOutput;
  }, []);

  return React.useSyncExternalStore(subscribe, getSnapshot);
}
