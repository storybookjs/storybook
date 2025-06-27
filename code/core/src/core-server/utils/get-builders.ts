import { MissingBuilderError } from 'storybook/internal/server-errors';
import type { Builder, Options } from 'storybook/internal/types';

import { fileURLToPath, parseNodeModulePath } from 'mlly';
import { dirname, isAbsolute } from 'pathe';

import { importModule, resolveModule } from '../../shared/utils/module';

export async function getManagerBuilder(): Promise<Builder<unknown>> {
  const builderManagerPath = resolveModule({
    pkg: 'storybook',
    customSuffix: 'dist/builder-manager/index.js',
  });
  return import(builderManagerPath);
}

export async function getPreviewBuilder(
  builderName: string,
  configDir: string
): Promise<Builder<unknown>> {
  let builderPackage;
  if (isAbsolute(builderName)) {
    // TODO: test this in Yarn PnP
    const parsedBuilderPackage = parseNodeModulePath(builderName);
    builderPackage =
      parsedBuilderPackage.name ||
      dirname(fileURLToPath(resolveModule({ pkg: builderName, parent: configDir })));
  } else {
    builderPackage = resolveModule({
      pkg: builderName,
      parent: configDir,
    });
  }
  return await importModule(builderPackage);
}

export async function getBuilders({ presets, configDir }: Options): Promise<Builder<unknown>[]> {
  const { builder } = await presets.apply('core', {});
  if (!builder) {
    throw new MissingBuilderError();
  }

  const builderName = typeof builder === 'string' ? builder : builder.name;

  return Promise.all([getPreviewBuilder(builderName, configDir), getManagerBuilder()]);
}
