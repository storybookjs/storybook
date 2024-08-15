import type { API_ComposedRef } from '@storybook/core/types';

import { logger } from '@storybook/core/client-logger';

import { getSourceType } from '../modules/refs';
import type { API } from '../root';

interface Meta {
  ref?: API_ComposedRef;
  source?: string;
  sourceType?: 'local' | 'external';
  sourceLocation?: string;
  refId?: string;
  v?: number;
  type: string;
}

export const getEventMetadata = (context: Meta, fullAPI: API) => {
  const { source, refId, type } = context;
  const [sourceType, sourceLocation] = getSourceType(source!, refId);

  let ref: API_ComposedRef | undefined;
  if (refId || sourceType === 'external') {
    ref =
      refId && fullAPI.getRefs()[refId]
        ? fullAPI.getRefs()[refId]
        : fullAPI.findRef(sourceLocation!);
  }
  const meta = {
    source,
    sourceType,
    sourceLocation,
    refId,
    ref,
    type,
  };

  switch (true) {
    case typeof refId === 'string':
    case sourceType === 'local':
    case sourceType === 'external': {
      return meta;
    }

    // if we couldn't find the source, something risky happened, we ignore the input, and log a warning
    default: {
      logger.warn(`Received a ${type} frame that was not configured as a ref`);
      return null;
    }
  }
};
