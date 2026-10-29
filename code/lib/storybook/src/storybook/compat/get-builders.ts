import { existsSync, readFileSync } from 'node:fs';

import { importModule, safeResolveModule } from '@storybook/core/internal/deep/utils/module';
import type { Builder } from '@storybook/core/internal/types';

import { isAbsolute, join } from 'pathe';

/** Import a legacy builder package by name or by its package directory. */
export async function getPreviewBuilder(resolvedPreviewBuilder: string): Promise<Builder<unknown>> {
  // `getAbsolutePath` turns a builder into its package directory, which ES modules cannot import, so
  // resolve the package's own entry point from inside it.
  const packageJson = join(resolvedPreviewBuilder, 'package.json');
  if (!isAbsolute(resolvedPreviewBuilder) || !existsSync(packageJson)) {
    return await importModule(resolvedPreviewBuilder);
  }
  const { name } = JSON.parse(readFileSync(packageJson, 'utf8'));
  return await importModule(safeResolveModule({ specifier: name, parent: packageJson }) ?? name);
}
