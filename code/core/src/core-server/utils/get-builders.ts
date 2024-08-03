import type { Builder, Options } from '@storybook/core/types';
import { MissingBuilderError } from '@storybook/core/server-errors';
import { pathToFileURL } from 'node:url';
import { isAbsolute, join } from 'node:path';
import * as resolve from 'resolve.exports';

export async function getManagerBuilder(): Promise<Builder<unknown>> {
  return import('@storybook/core/builder-manager');
}

export async function getPreviewBuilder(
  builderName: string,
  configDir: string
): Promise<Builder<unknown>> {
  let builderPackage = builderName;

  if (builderName === 'webpack5') {
    builderPackage = '@storybook/builder-webpack5';
  }

  try {
    const pkg = require(join(builderPackage, 'package.json'));
    const subpath = resolve.exports(pkg, '.');

    if (subpath) {
      builderPackage = join(builderPackage, ...subpath);
    }
  } catch (err) {
    // failed = true;
  }

  builderPackage = require.resolve(builderName);

  if (isAbsolute(builderName)) {
    builderPackage = pathToFileURL(builderPackage).href;
  }

  const previewBuilder = await import(builderPackage);
  console.log({ builderPackage, href: pathToFileURL(builderPackage).href });
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
