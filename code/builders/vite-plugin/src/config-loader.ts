import { resolvePathInStorybookCache } from 'storybook/internal/common';
import { experimental_loadStorybook } from 'storybook/internal/core-server';
import { oneWayHash } from 'storybook/internal/telemetry';
import type { Options } from 'storybook/internal/types';

import { relative, resolve } from 'pathe';

const cache = new Map<string, Promise<Options>>();

export async function loadStorybookConfig(configDir: string): Promise<Options> {
  const resolvedConfigDir = resolve(configDir);

  const cached = cache.get(resolvedConfigDir);
  if (cached) {
    return cached;
  }

  const promise = (async () => {
    const cacheKey = oneWayHash(relative(process.cwd(), resolvedConfigDir));
    const outputDir = resolvePathInStorybookCache('public', cacheKey);

    const options = await experimental_loadStorybook({
      configDir: resolvedConfigDir,
      packageJson: {},
    });

    options.outputDir = outputDir;

    return options;
  })();

  cache.set(resolvedConfigDir, promise);
  return promise;
}
