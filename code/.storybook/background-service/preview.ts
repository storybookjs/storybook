/**
 * Preview-side registration for the example background-color service.
 *
 * Registers the service in the preview iframe, subscribes to `getColor`, and
 * updates the document background whenever the color changes — whether driven by
 * the manager toolbar or any other peer.
 *
 * This module is intentionally renderer-agnostic: it uses the raw `.subscribe()`
 * API rather than any framework-specific hooks.
 *
 * Wire-up in preview.tsx (or your renderer's equivalent):
 *
 * ```ts
 * import './background-service/preview.ts'; // side-effect import
 * ```
 *
 * Or, to access the service instance:
 *
 * ```ts
 * import { backgroundService } from './background-service/preview.ts';
 * ```
 */

import { registerService } from '../../core/src/shared/open-service/preview.ts';
import { backgroundServiceDef } from './definition.ts';

export const backgroundService = registerService(backgroundServiceDef);

backgroundService.queries.getColor.subscribe(undefined, (color) => {
  if (typeof document !== 'undefined') {
    // The internal Storybook preview no longer sets body background from the manager theme
    // (see ThemedSetRoot in preview.tsx); a plain assignment is enough here.
    document.body.style.background = color;
  }
});
