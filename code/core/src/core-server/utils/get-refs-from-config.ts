import type { Options } from 'storybook/internal/types';

import type { SourceWithUrl } from '../../shared/open-service/toolsets/docs/sources.ts';

/**
 * Reads the composed Storybooks from the project's `refs` as docs sources, in config order.
 *
 * Only the configured `refs` count, not auto-refs from package dependencies. Disabled refs and
 * refs without a `url` are dropped; a trailing slash is stripped so manifest paths resolve the
 * same for every ref. No network access.
 */
export async function getRefsFromConfig(options: Options): Promise<SourceWithUrl[]> {
  const refs = (await options.presets.apply('refs')) ?? {};

  return Object.entries(refs).flatMap(([id, ref]) => {
    if (!ref || typeof ref !== 'object') {
      return [];
    }
    const { title, url, disable } = ref as Partial<{
      title: string;
      url: string;
      disable: boolean;
    }>;
    if (disable || typeof url !== 'string' || url.length === 0) {
      return [];
    }
    return [{ id, title: title || id, url: url.replace(/\/$/, '') }];
  });
}
