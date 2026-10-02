import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { MissingBuilderError } from 'storybook/internal/server-errors';
import type { Builder, Options } from 'storybook/internal/types';

import { resolveModulePath } from 'exsolve';

import { importModule } from '../../shared/utils/module.ts';

export async function getManagerBuilder(): Promise<Builder<unknown>> {
  return await import('../../builder-manager/index.ts');
}

// `getAbsolutePath` turns a builder into its package directory, which ES modules cannot import, so
// resolve the package's own entry point from inside it.
const resolvePackageEntry = (builder: string) => {
  const packageJson = join(builder, 'package.json');
  if (!isAbsolute(builder) || !existsSync(packageJson)) {
    return builder;
  }
  const { name } = JSON.parse(readFileSync(packageJson, 'utf8'));
  return resolveModulePath(name, { from: pathToFileURL(packageJson) });
};

export async function getPreviewBuilder(resolvedPreviewBuilder: string): Promise<Builder<unknown>> {
  return await importModule(resolvePackageEntry(resolvedPreviewBuilder));
}

export async function getBuilders({ presets }: Options): Promise<Builder<unknown>[]> {
  const { builder } = await presets.apply('core', {});
  if (!builder) {
    throw new MissingBuilderError();
  }

  const resolvedPreviewBuilder = typeof builder === 'string' ? builder : builder.name;

  return Promise.all([getPreviewBuilder(resolvedPreviewBuilder), getManagerBuilder()]);
}
