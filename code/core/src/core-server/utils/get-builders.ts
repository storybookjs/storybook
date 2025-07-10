import { MissingBuilderError } from 'storybook/internal/server-errors';
import type { Builder, Options } from 'storybook/internal/types';

import { join } from 'pathe';

import { importModule, resolvePackageDir } from '../../shared/utils/module';

export async function getManagerBuilder(): Promise<Builder<unknown>> {
  const builderManagerPath = join(resolvePackageDir('storybook'), 'dist/builder-manager/index.js');
  return import(builderManagerPath);
}

export async function getPreviewBuilder(builderName: string): Promise<Builder<unknown>> {
  return await importModule(builderName);
}

export async function getBuilders({ presets }: Options): Promise<Builder<unknown>[]> {
  const { builder } = await presets.apply('core', {});
  if (!builder) {
    throw new MissingBuilderError();
  }

  const builderName = typeof builder === 'string' ? builder : builder.name;

  return Promise.all([getPreviewBuilder(builderName), getManagerBuilder()]);
}
