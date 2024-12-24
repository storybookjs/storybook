import { pathToFileURL } from 'node:url';

import type { Builder, Options } from '@storybook/core/types';

import { MissingBuilderError } from '@storybook/core/server-errors';

export async function getManagerBuilder(): Promise<Builder<unknown>> {
  return import('@storybook/core/builder-manager');
}

export async function getPreviewBuilder(
  builderName: string,
  configDir: string
): Promise<Builder<unknown>> {
  const builderPackage = require.resolve(
    ['webpack5'].includes(builderName) ? `@storybook/builder-${builderName}` : builderName,
    { paths: [configDir] }
  );
  const previewBuilder = await import(pathToFileURL(builderPackage).href);
  return previewBuilder;
}

export async function getBuilders({ presets, configDir }: Options): Promise<Builder<unknown>[]> {
  const { builder } = await presets.apply('core', {});

  if (!builder) {
    throw new MissingBuilderError();
  }

  const builderName = typeof builder === 'string' ? builder : builder.name;

  return Promise.all([getPreviewBuilder(builderName, configDir), getManagerBuilder()]);
}
