import { toTitle } from 'storybook/internal/common';
import type { Options, Ref } from 'storybook/internal/types';

import type { SourceWithUrl } from '../../shared/open-service/toolsets/docs/sources.ts';

/**
 * Reads the composed Storybooks from the project's `refs` as docs sources, in config order.
 *
 * Only the configured `refs` count, not auto-refs from package dependencies; a function-form
 * `refs` receives an empty object instead of them. Disabled refs and refs without a `url` are
 * dropped. Ids and titles are normalised the way the manager does for the sidebar, so a source id
 * matches the ref id in Storybook URLs. No network access.
 */
export async function getRefsFromConfig(options: Options): Promise<SourceWithUrl[]> {
  const refs = (await options.presets.apply<Record<string, Ref>>('refs', {})) ?? {};

  return Object.entries(refs)
    .filter(([, ref]) => ref?.url && !ref.disable)
    .map(([key, ref]) => ({
      id: key.toLowerCase(),
      title: ref.title || toTitle(key),
      url: ref.url.replace(/\/$/, ''),
    }));
}
