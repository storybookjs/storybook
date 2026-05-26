import { computed, effect } from 'alien-signals';

import * as React from 'react';

import type { InputOfQuery, OutputOfQuery, ServiceDefinition, ServiceStore } from './types.ts';

/**
 * React hook: subscribe to a service query.
 *
 * Signals-backed. Per `(service, queryName, input)` we build a `computed(() => query(input))`
 * that closes over the input and re-evaluates whenever the underlying state signal changes.
 * `computed` memoises by reference equality on its output, so the React component only
 * re-renders when *this query's* result actually changes — no extra dedup layer needed.
 *
 * Subscription is wired through `useSyncExternalStore` so the hook works in any React 18+
 * tree without a Babel transform or `useSignals()` opt-in. The `effect` we install reads the
 * computed (which registers the dependency) and forwards change notifications to React's
 * listener. The effect's mandatory first synchronous fire is swallowed so React doesn't see
 * a no-op store update on mount.
 *
 * **Memoise object inputs at the call site.** The input participates in the hook's React
 * deps; passing a new object literal each render rebuilds the computed + subscription each
 * render. For complex inputs wrap them in `useMemo` (or pass primitives).
 *
 * @example
 *
 * ```tsx
 * const docgen = useServiceQuery(DocgenService, 'getComponentDocgenInfo', componentId);
 * ```
 */
export function useServiceQuery<
  TDef extends ServiceDefinition<any, any, any>,
  TQueries extends TDef['queries'] = TDef['queries'],
  TKey extends keyof TQueries & string = keyof TQueries & string,
>(
  service: ServiceStore<TDef>,
  queryName: TKey,
  ...inputArg: [InputOfQuery<TQueries[TKey]>] extends [void] ? [] : [InputOfQuery<TQueries[TKey]>]
): OutputOfQuery<TQueries[TKey]> {
  const query = service.queries[queryName] as unknown as {
    (input?: unknown): unknown;
    subscribe: (...args: unknown[]) => () => void;
  };
  const input = inputArg[0] as unknown;
  const hasInput = inputArg.length > 0;

  // One computed per (query, input). Calling `query(input)` inside the computed runs the
  // selector (which reads the state signal — registering the dependency) AND fires the
  // paired preload on first read (idempotent thereafter). When `input` changes between
  // renders this useMemo re-creates the computed, which closes over the new input.
  const comp = React.useMemo(
    () => computed(() => (hasInput ? query(input) : query())),
    [query, hasInput, input]
  );

  // Subscribe via an effect that touches `comp` to register the dependency and forwards
  // change notifications to React. `effect()` always fires once synchronously at install
  // time; swallow that so React doesn't observe a phantom store update on mount.
  const subscribe = React.useCallback(
    (listener: () => void) => {
      let initial = true;
      return effect(() => {
        comp();
        if (initial) {
          initial = false;
          return;
        }
        listener();
      });
    },
    [comp]
  );

  // Snapshot is just "read the computed." Called outside of any tracked context, so this
  // is an untracked read of the memoised result — no subscription side-effect.
  const getSnapshot = React.useCallback(() => comp(), [comp]);

  return React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot) as OutputOfQuery<
    TQueries[TKey]
  >;
}
