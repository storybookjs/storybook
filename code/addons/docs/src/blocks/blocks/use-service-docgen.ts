import { useEffect, useMemo, useReducer, useRef } from 'react';

import type { DocgenPayload } from 'storybook/internal/types';

import { type DocgenService, type QueryState, seedQueryState } from 'storybook/open-service';
import { getService } from 'storybook/preview-api';

/**
 * Subscribes docs blocks to the preview's local `core/docgen` runtime.
 *
 * Returns the full {@link QueryState} — `data` plus the load lifecycle (`isInitialLoading`,
 * `isError`, etc.) — so blocks can show a loading skeleton or error state instead of rendering
 * nothing while docgen resolves. `data` mirrors the query's output (a {@link DocgenPayload}, or
 * `undefined` when nothing has been extracted for the id yet).
 *
 * Requires a concrete component id and a registered `core/docgen` service. Callers whose service may
 * be absent (e.g. behind `experimentalDocgenServer`) must guard at a parent and conditionally render
 * a child that calls this hook.
 *
 * Deliberately does NOT reuse the manager-side `useServiceQuery`: that hook is built on
 * `useSyncExternalStore`, which only exists in React 18+, and the preview-side docs blocks must keep
 * working on React 16/17. This is a small, query-specific subscription instead — the current state is
 * seeded synchronously during render (so switching components never lags a frame) and the
 * subscription forces a re-render whenever the query emits a new {@link QueryState}.
 */
export function useServiceDocgen(id: string): QueryState<DocgenPayload | undefined> {
  const service = useMemo(() => getService<DocgenService>('core/docgen'), []);
  const [, forceRender] = useReducer((tick: number) => tick + 1, 0);
  const cache = useRef<{ id: string; state: QueryState<DocgenPayload | undefined> }>(undefined);

  // Seed synchronously whenever the id changes, so the returned state is always for the requested id
  // and never one render behind. `seedQueryState` reads `.get()` (a pure read that fires no load) and
  // wraps it in a synthetic `pending` state until the subscription delivers the real lifecycle.
  if (cache.current?.id !== id) {
    cache.current = { id, state: seedQueryState(service.queries.getDocgen, { id }) };
  }

  useEffect(() => {
    return service.queries.getDocgen.subscribe({ id }, (state) => {
      cache.current = { id, state };
      forceRender();
    });
  }, [service, id]);

  return cache.current.state;
}
