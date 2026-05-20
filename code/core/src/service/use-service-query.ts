import * as React from 'react';

import type { InputOfQuery, OutputOfQuery, ServiceDefinition, ServiceStore } from './types.ts';

/**
 * React hook: subscribe to a service query.
 *
 * Uses `useSyncExternalStore` and only re-renders when *this specific query's* result changes
 * (per the runtime's structural-equality check).
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

  const snapshotRef = React.useRef<unknown>(undefined as unknown);
  const primedRef = React.useRef<boolean>(false);
  if (!primedRef.current) {
    snapshotRef.current = hasInput ? query(input) : query();
    primedRef.current = true;
  }

  const subscribe = React.useCallback(
    (listener: () => void) => {
      const onChange = (value: unknown) => {
        snapshotRef.current = value;
        listener();
      };
      return hasInput ? query.subscribe(input, onChange) : query.subscribe(onChange);
    },
    [query, hasInput, input]
  );

  const getSnapshot = React.useCallback(() => snapshotRef.current, []);

  return React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot) as OutputOfQuery<
    TQueries[TKey]
  >;
}
