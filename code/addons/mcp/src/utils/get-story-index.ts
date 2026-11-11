import type { Options, StoryIndex } from 'storybook/internal/types';
import type { StoryIndexGenerator } from 'storybook/internal/core-server';
import { logger } from 'storybook/internal/node-logger';

/**
 * Resolves the Storybook story index in-process via the `storyIndexGenerator` preset, rather than
 * fetching `/index.json` over loopback HTTP.
 *
 * The dev-server registers and memoises a single `StoryIndexGenerator` (see Storybook's
 * `common-preset`); applying the preset here returns that same live instance, so `getIndex()`
 * hands back the up-to-date, internally-cached index without a network round-trip. This also keeps
 * the index in lock-step with HMR — the generator's watcher refreshes `lastIndex` as files change.
 *
 * @param options - The Storybook options object carrying the resolved presets.
 * @returns A promise that resolves to the StoryIndex.
 * @throws If the generator preset is unavailable (e.g. not running inside a dev server).
 */
export async function getStoryIndex(options: Options): Promise<StoryIndex> {
  const generator = await options.presets.apply<StoryIndexGenerator | undefined>(
    'storyIndexGenerator'
  );

  if (!generator) {
    throw new Error(
      'Storybook story index generator is unavailable. These MCP tools require a running Storybook dev server with a builder that exposes the story index.'
    );
  }

  const index = await generator.getIndex();

  logger.debug(`Story index entries found: ${Object.keys(index.entries).length}`);

  return index;
}
