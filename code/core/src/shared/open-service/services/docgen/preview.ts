import { definePreviewAddon } from 'storybook/internal/csf';

import type { ServiceInstanceOf } from 'storybook/open-service';

import { registerService } from '../../preview.ts';
import { docgenServiceDef } from './definition.ts';

export type DocgenService = ServiceInstanceOf<typeof docgenServiceDef>;

export default () =>
  definePreviewAddon({
    beforeAll: () => {
      if (globalThis.FEATURES?.experimentalDocgenServer) {
        registerService(docgenServiceDef);
      }
    },
  });
