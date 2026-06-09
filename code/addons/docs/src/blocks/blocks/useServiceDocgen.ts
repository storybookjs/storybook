import { useEffect, useMemo, useState } from 'react';

import type { DocgenPayload } from 'storybook/internal/types';

import type { DocgenService } from 'storybook/open-service';
import { getService } from 'storybook/preview-api';

/**
 * Subscribes docs blocks to the preview's local `core/docgen` runtime.
 */
export function useServiceDocgen(id: string | undefined): DocgenPayload | undefined {
  const service = useMemo(() => {
    try {
      return getService<DocgenService>('core/docgen');
    } catch {
      return undefined;
    }
  }, []);
  const [payload, setPayload] = useState<DocgenPayload | undefined>(undefined);

  useEffect(() => {
    if (!service || !id) {
      return undefined;
    }

    return service.queries.getDocgen.subscribe({ id }, setPayload);
  }, [id, service]);

  return payload;
}
