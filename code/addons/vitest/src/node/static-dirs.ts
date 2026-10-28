import { mkdir } from 'node:fs/promises';

import { resolvePathInStorybookCache } from '@storybook/core/internal/common';
import type { StorybookConfigRaw } from '@storybook/core/internal/types';

import { COVERAGE_DIRECTORY } from '../constants.ts';

type StaticDirs = NonNullable<StorybookConfigRaw['staticDirs']>;

/** Serve the coverage report at `/coverage` in development. */
export async function withCoverageStaticDir(
  values: StaticDirs = [],
  configType: 'DEVELOPMENT' | 'PRODUCTION' | undefined
): Promise<StaticDirs> {
  if (configType === 'PRODUCTION') {
    return values;
  }

  const coverageDirectory = resolvePathInStorybookCache(COVERAGE_DIRECTORY);
  await mkdir(coverageDirectory, { recursive: true });
  return [
    {
      from: coverageDirectory,
      to: '/coverage',
    },
    ...values,
  ];
}
