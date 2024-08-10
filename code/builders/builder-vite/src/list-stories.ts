import * as path from 'node:path';

import { commonGlobOptions, normalizeStories } from 'storybook/internal/common';
import type { Options } from 'storybook/internal/types';

import { glob } from 'glob';
import slash from 'slash';

export async function listStories(options: Options) {
  const { normalizePath } = await import('vite');

  return (
    (
      await Promise.all(
        normalizeStories(await options.presets.apply('stories', [], options), {
          configDir: options.configDir,
          workingDir: options.configDir,
        }).map(({ directory, files }) => {
          const pattern = path.join(directory, files);
          const absolutePattern = path.isAbsolute(pattern)
            ? pattern
            : path.join(options.configDir, pattern);

          return glob(slash(absolutePattern), {
            ...commonGlobOptions(absolutePattern),
            follow: true,
          });
        })
      )
    )
      .reduce((carry, stories) => carry.concat(stories.map(normalizePath)), [])
      // Sort stories to prevent a non-deterministic build. The result of Glob is not sorted an may differ
      // for each invocation. This results in a different bundle file hashes from one build to the next.
      .sort()
  );
}
