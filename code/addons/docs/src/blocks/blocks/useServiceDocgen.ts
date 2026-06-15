import { useCallback, useMemo, useRef, useSyncExternalStore } from 'react';

import type { DocgenPayload } from 'storybook/internal/types';

import type { DocgenService } from 'storybook/open-service';
import { getService } from 'storybook/preview-api';

type SnapshotCache = {
  id: string | undefined;
  value: DocgenPayload | undefined;
};

/** Subscribes docs blocks to the preview's local `core/docgen` runtime. */
export function useServiceDocgen(id: string | undefined): DocgenPayload | undefined {
  const snapshotCache = useRef<SnapshotCache>({ id: undefined, value: undefined });
  const service = useMemo(() => {
    try {
      return getService<DocgenService>('core/docgen');
    } catch {
      return undefined;
    }
  }, []);

  const getSnapshot = useCallback(() => {
    return snapshotCache.current.id === id ? snapshotCache.current.value : undefined;
  }, [id]);

  const subscribe = useCallback(
    (listener: () => void) =>
      service && id
        ? service.queries.getDocgen.subscribe({ id }, (value) => {
            snapshotCache.current = { id, value };
            listener();
          })
        : () => {},
    [service, id]
  );

  return useSyncExternalStore(subscribe, getSnapshot);
}
