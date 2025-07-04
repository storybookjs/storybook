import { MissingBuilderError } from 'storybook/internal/server-errors';
import type { Builder, Options } from 'storybook/internal/types';

import { join } from 'pathe';

import { importModule, resolvePackageDir } from '../../shared/utils/module';

export async function getManagerBuilder(): Promise<Builder<unknown>> {
  const builderManagerPath = join(resolvePackageDir('storybook'), 'dist/builder-manager/index.js');
  return import(builderManagerPath);
}

export async function getPreviewBuilder(
  builderName: string,
  configDir: string
): Promise<Builder<unknown>> {
  return await importModule(import.meta.resolve(builderName, configDir));
}

export async function getBuilders({ presets, configDir }: Options): Promise<Builder<unknown>[]> {
  const { builder } = await presets.apply('core', {});
  if (!builder) {
    throw new MissingBuilderError();
  }

  const builderName = typeof builder === 'string' ? builder : builder.name;

  return Promise.all([getPreviewBuilder(builderName, configDir), getManagerBuilder()]);
}
