import { MissingBuilderError } from 'storybook/internal/server-errors';
import type { Builder, Options } from 'storybook/internal/types';

import { parseNodeModulePath } from 'mlly';
import { isAbsolute } from 'pathe';

import { resolveModule } from '../../shared/utils/resolve';

export async function getManagerBuilder(): Promise<Builder<unknown>> {
  return import('storybook/internal/builder-manager');
}

export async function getPreviewBuilder(
  builderName: string,
  configDir: string
): Promise<Builder<unknown>> {
  let builderPackage;
  if (isAbsolute(builderName)) {
    // TODO: test this in Yarn PnP
    const parsedBuilderPackage = parseNodeModulePath(builderName);
    if (!parsedBuilderPackage.name) {
      console.error(parsedBuilderPackage);
      throw new Error('Invalid builder package');
    }
    builderPackage = parsedBuilderPackage.name;
  } else {
    builderPackage = resolveModule({
      pkg: builderName,
      parent: configDir,
    });
  }
  return await import(builderPackage);
}

export async function getBuilders({ presets, configDir }: Options): Promise<Builder<unknown>[]> {
  const { builder } = await presets.apply('core', {});

  if (!builder) {
    throw new MissingBuilderError();
  }

  const builderName = typeof builder === 'string' ? builder : builder.name;

  return Promise.all([getPreviewBuilder(builderName, configDir), getManagerBuilder()]);
}
