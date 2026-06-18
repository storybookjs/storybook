import type { DocgenPayload } from 'storybook/internal/types';

import { type DocgenService, type QueryState } from 'storybook/open-service';
import { getService } from 'storybook/preview-api';

import { useQuerySubscription } from './use-query-subscription.ts';

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
 * a child that calls this hook. The React 16/17-safe subscription mechanics live in
 * {@link useQuerySubscription}.
 */
export function useServiceDocgen(id: string): QueryState<DocgenPayload | undefined> {
  const service = getService<DocgenService>('core/docgen');
  return useQuerySubscription(id, service.queries.getDocgen, { id });
}
