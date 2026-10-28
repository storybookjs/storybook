import { existsSync, readFileSync } from 'node:fs';

import { importModule, safeResolveModule } from '@storybook/core/internal/deep/utils/module';
import { MissingBuilderError } from '@storybook/core/internal/server-errors';
import type { Builder, Options } from '@storybook/core/internal/types';

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

export async function getManagerBuilder(): Promise<Builder<unknown>> {
  return await import('@storybook/manager/internal/deep/builder-manager');
}

/** @deprecated Read `storybook.builder` from an instance created with `createStorybook`. */
export async function getBuilders({ presets }: Options): Promise<Builder<unknown>[]> {
  const { builder } = await presets.apply('core', {});
  if (!builder) {
    throw new MissingBuilderError();
  }

  const resolvedPreviewBuilder = typeof builder === 'string' ? builder : builder.name;

  return Promise.all([getPreviewBuilder(resolvedPreviewBuilder), getManagerBuilder()]);
}
