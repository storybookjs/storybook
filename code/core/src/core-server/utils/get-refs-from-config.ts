import { toTitle } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';
import type { Options, Ref } from 'storybook/internal/types';

import type { SourceWithUrl } from '../../shared/open-service/toolsets/docs/sources.ts';

/**
 * Reads the composed Storybooks from the project's `refs` as docs sources, in config order.
 *
 * Only the configured `refs` count, not auto-refs from package dependencies; a function-form
 * `refs` receives an empty object instead of them. Disabled refs and refs without a `url` are
 * dropped, and so is a ref keyed `local`, the id reserved for this Storybook's own source. Ids and
 * titles are normalised the way the manager does for the sidebar, so a source id matches the ref id
 * in Storybook URLs. No network access.
 */
export async function getRefsFromConfig(options: Options): Promise<SourceWithUrl[]> {
  const refs = (await options.presets.apply<Record<string, Ref>>('refs', {})) ?? {};

  return Object.entries(refs)
    .filter(([, ref]) => ref?.url && !ref.disable)
    .map(([key, ref]) => ({
      id: key.toLowerCase(),
      title: ref.title || toTitle(key),
      url: ref.url.replace(/\/$/, ''),
    }))
    .filter(({ id }) => {
      if (id !== 'local') {
        return true;
      }
      logger.warn(
        'The ref "local" is left out of the docs toolset: "local" is the id of this Storybook\'s own source. Rename the ref to list it.'
      );
      return false;
    });
}
