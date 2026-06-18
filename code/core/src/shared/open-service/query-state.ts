import type { LoadStatus, QueryState, QueryStatus } from './types.ts';

/** The `load` lifecycle slice that, together with `data`, expands into a full {@link QueryState}. */
export type QueryLifecycle = {
  status: QueryStatus;
  error: Error | undefined;
  loadStatus: LoadStatus;
};

/**
 * Expands a `(data, lifecycle)` pair into the full {@link QueryState} surfaced to subscribers.
 *
 * The single source of truth for the derived booleans, shared by the runtime's subscription
 * emissions and `useServiceQuery`'s first-render seed so they can never drift apart. The booleans
 * intentionally follow our `load` vocabulary: `isLoading` is "any load in flight" (TanStack's
 * `isFetching`) and `isInitialLoading` is "the first load, no data yet" (TanStack's `isLoading`).
 */
export function buildQueryState<TData>(
  data: TData | undefined,
  lifecycle: QueryLifecycle
): QueryState<TData> {
  const isPending = lifecycle.status === 'pending';
  const isLoading = lifecycle.loadStatus === 'loading';
  return {
    data,
    error: lifecycle.error,
    status: lifecycle.status,
    loadStatus: lifecycle.loadStatus,
    isPending,
    isSuccess: lifecycle.status === 'success',
    isError: lifecycle.status === 'error',
    isLoading,
    isInitialLoading: isPending && isLoading,
    isRefreshing: isLoading && !isPending,
  };
}

/** Coerces an unknown thrown value into an `Error` for the `error` field of a {@link QueryState}. */
export function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

/**
 * Builds the synthetic first-render {@link QueryState} for a subscription hook, from a pure
 * `query.get(input)` read.
 *
 * Subscription hooks must return a {@link QueryState} on their very first render, before the
 * subscription's first emission has delivered the real lifecycle (`useSyncExternalStore` reads the
 * snapshot during render; the React 16-compatible preview hooks read it synchronously too). `get()`
 * returns only data (no lifecycle, no load), so we pair it with a `pending`/`loading` status as a
 * placeholder until the subscription delivers the real lifecycle moments later. A throw from
 * `get()` (e.g. input validation) becomes an `error` state — mirroring what the subscription would
 * emit — so the hook never throws during render.
 *
 * Shared by the manager-side `useServiceQuery` and the preview-side docs hooks so their first-render
 * seeds can never drift apart.
 *
 * Only the query's `get` method is needed, so the parameter is narrowed to that shape: `TOutput` then
 * infers purely (and reliably) from `get`'s return type, rather than through the contravariant
 * positions of the full `Query` type — which would widen `TOutput` and break callers that pass a
 * query with a hand-written payload type.
 */
export function seedQueryState<TInput, TOutput>(
  query: { get(input: TInput): TOutput },
  input: TInput
): QueryState<TOutput>;
export function seedQueryState<TInput, TOutput, TSelected>(
  query: { get(input: TInput): TOutput },
  input: TInput,
  selector: (value: TOutput) => TSelected
): QueryState<TSelected>;
export function seedQueryState(
  query: { get(input: unknown): unknown },
  input: unknown,
  selector?: (value: unknown) => unknown
): QueryState<unknown> {
  try {
    const output = query.get(input);
    return buildQueryState(selector ? selector(output) : output, {
      status: 'pending',
      error: undefined,
      loadStatus: 'loading',
    });
  } catch (error) {
    return buildQueryState(undefined, {
      status: 'error',
      error: toError(error),
      loadStatus: 'idle',
    });
  }
}
