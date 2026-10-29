import { definePreviewAddon } from '../../../../csf/index.ts';

import type { ServiceInstanceOf } from '@storybook/core/open-service';

import { getFeatures } from '../../../features.ts';
import { registerService } from '../../preview.ts';
import { docgenServiceDef } from './definition.ts';

export type DocgenService = ServiceInstanceOf<typeof docgenServiceDef>;

export default definePreviewAddon({
  beforeAll: () => {
    if (getFeatures().docgenServer) {
      registerService(docgenServiceDef);
    }
  },
});
