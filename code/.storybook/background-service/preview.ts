/**
 * Preview-side registration for the example background-color service.
 *
 * Registers the service in the preview iframe, subscribes to `getColor`, and
 * updates the document background whenever the color changes — whether driven by
 * the manager toolbar or any other peer.
 *
 * Loaded from `preview.tsx` after builders install the preview channel (see iframe virtual entry).
 *
 * ```ts
 * import './background-service/preview.ts'; // side-effect import
 * ```
 */

import { registerService } from 'storybook/preview-api';

import { backgroundServiceDef } from './definition.ts';

export const backgroundService = registerService(backgroundServiceDef);

backgroundService.queries.getColor.subscribe(undefined, (color) => {
  if (typeof document !== 'undefined') {
    document.body.style.background = color;
  }
});
