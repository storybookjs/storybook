import type { StrictArgTypes } from 'storybook/internal/types';

import { global } from '@storybook/global';

import { getService } from '../../../shared/open-service/preview.ts';
import { combineParameters } from './parameters.ts';

/** How long a render may wait for the `core/docgen` service to resolve the current component. */
const DOCGEN_LOAD_TIMEOUT_MS = 2000;

/**
 * Synchronously reads the server-extracted docgen argTypes for a component, if they are already
 * available.
 *
 * Returns `undefined` when the flag is off (no call), the service is not registered (portable
 * stories, unit tests), or nothing has been extracted yet — callers treat that as a graceful
 * no-op rather than a failure.
 */
export function getDocgenServiceArgTypes(componentId: string): StrictArgTypes | undefined {
  if (!global.FEATURES?.experimentalDocgenServer) {
    return undefined;
  }

  try {
    const payload = getService('core/docgen', { internal: true }).queries.docgen.get({
      id: componentId,
    });

    return payload?.argTypes;
  } catch {
    // The docgen service is not part of every runtime (e.g. portable stories without the
    // preview annotations). Rendering proceeds without server argTypes instead of throwing.
    return undefined;
  }
}

/**
 * Layers server-extracted argTypes beneath the story-side argTypes, mirroring the manager-side
 * `mergeServiceArgTypes` precedence: user-authored `customArgTypes` win over the server payload,
 * which wins over inference (second-pass argTypes enhancers stay filtered, so nothing is
 * inferred in the preview under this flag).
 */
export function mergeDocgenServiceArgTypes({
  serverArgTypes,
  argTypes,
}: {
  serverArgTypes: StrictArgTypes;
  argTypes: StrictArgTypes;
}): StrictArgTypes {
  return combineParameters(serverArgTypes, argTypes) as StrictArgTypes;
}

/**
 * Awaits the authoritative docgen payload for one component, bounded by `DOCGEN_LOAD_TIMEOUT_MS`.
 *
 * The manager deliberately defers docgen extraction past the first-render window, so a render
 * that starts right after story selection normally outruns it; without waiting, the first render
 * would never see server argTypes. The returned payload is authoritative: it is the command
 * output rather than a later state read, which can lag behind. Resolves to `undefined` on
 * timeout, unregistered service, or failed extraction — rendering must not depend on docgen.
 */
export async function loadDocgenServiceArgTypes(
  componentId: string
): Promise<StrictArgTypes | undefined> {
  if (!global.FEATURES?.experimentalDocgenServer) {
    return undefined;
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<void>((resolve) => {
      timer = setTimeout(resolve, DOCGEN_LOAD_TIMEOUT_MS);
    });
    const payload = await Promise.race([
      getService('core/docgen', { internal: true })
        .queries.docgen.loaded({ id: componentId })
        .catch(() => undefined),
      timeout,
    ]);

    return payload?.argTypes;
  } catch {
    // Service unavailable or extraction failed — render without server argTypes.
    return undefined;
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}
