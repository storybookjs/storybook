import { useCallback, useMemo, useSyncExternalStore } from 'react';

import type { DocgenPayload } from 'storybook/internal/types';

import type { DocgenService } from 'storybook/open-service';
import { getService } from 'storybook/preview-api';

/**
 * Subscribes docs blocks to the preview's local `core/docgen` runtime.
 *
 * Backed by `useSyncExternalStore` for tear-free, concurrent-safe reads. `getDocgen` reads
 * `state.components[id]` by reference, so a snapshot is `Object.is`-stable until the payload
 * actually changes — no extra equality layer needed.
 */
export function useServiceDocgen(id: string | undefined): DocgenPayload | undefined {
  const service = useMemo(() => {
    try {
      return getService<DocgenService>('core/docgen');
    } catch {
      return undefined;
    }
  }, []);

  const subscribe = useCallback(
    (listener: () => void) =>
      service && id ? service.queries.getDocgen.subscribe({ id }, listener) : () => {},
    [service, id]
  );

  const getSnapshot = useCallback(
    () => (service && id ? service.queries.getDocgen({ id }) : undefined),
    [service, id]
  );

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
