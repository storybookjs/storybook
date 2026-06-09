import { definePreviewAddon } from 'storybook/internal/csf';

import type { ServiceInstanceOf } from 'storybook/open-service';

import { registerService } from '../../preview.ts';
import { docgenServiceDef } from './definition.ts';

export type DocgenService = ServiceInstanceOf<typeof docgenServiceDef>;

/**
 * Core preview annotation that registers the `core/docgen` runtime.
 *
 * Added to `getCoreAnnotations` like every other core annotation, but registration happens in
 * `beforeAll` rather than at module top-level. `beforeAll` is the one hook guaranteed to run after the
 * addons channel is installed and only in a real preview lifecycle — core annotations themselves are
 * evaluated in channel-less contexts (portable stories, pre-channel runtime boot) and composed
 * multiple times per boot, so a top-level registration here would be unsafe. Addon/user services can
 * register at top-level because their preview modules load after the channel; core cannot.
 */
export default () =>
  definePreviewAddon({
    beforeAll: async () => {
      if (globalThis.FEATURES?.experimentalDocgenServer) {
        registerPreviewDocgenService();
      }
    },
  });

/**
 * Registers the preview-side `core/docgen` runtime.
 *
 * The server owns the extraction commands; the preview only needs a local handle so docs blocks can
 * read the synced state via `getService('core/docgen')`. Custom argTypes are not pushed into the
 * service — consumers layer those in from the prepared story. Safe to call repeatedly:
 * `registerService` is idempotent by id.
 */
export function registerPreviewDocgenService(): DocgenService {
  return registerService(docgenServiceDef);
}
