import { MissingBuilderError } from 'storybook/internal/server-errors';
import type { Builder, Options } from 'storybook/internal/types';

import { importModule } from '../../shared/utils/module';

export async function getManagerBuilder(): Promise<Builder<unknown>> {
  return await import('../../builder-manager/index');
}

export async function getPreviewBuilder(resolvedPreviewBuilder: string): Promise<Builder<unknown>> {
  return await importModule(resolvedPreviewBuilder);
}

export async function getBuilders({ presets }: Options): Promise<Builder<unknown>[]> {
  const { builder } = await presets.apply('core', {});
  if (!builder) {
    throw new MissingBuilderError();
  }

  const resolvedPreviewBuilder = typeof builder === 'string' ? builder : builder.name;

  return Promise.all([getPreviewBuilder(resolvedPreviewBuilder), getManagerBuilder()]);
}
