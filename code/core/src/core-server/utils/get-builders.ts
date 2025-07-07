import { readFile, stat } from 'node:fs/promises';

import { MissingBuilderError } from 'storybook/internal/server-errors';
import type { Builder, Options } from 'storybook/internal/types';

import { join } from 'pathe';

export async function getManagerBuilder(): Promise<Builder<unknown>> {
  return import('../../builder-manager/index');
}

/**
 * BuilderName might be:
 *
 * - An absolute path to a real js file, fully resolved
 * - A directory, in which case we look for a package.json and use the name field to resolve the
 *   entrypoint
 * - A relative path, in which case we resolve it against the configDir
 */
async function resolveBuilderEntrypoint(builderName: string, configDir: string): Promise<string> {
  try {
    const stats = await stat(builderName);
    if (stats.isFile()) {
      return builderName;
    }
    if (stats.isDirectory()) {
      const packageJsonPath = join(builderName, 'package.json');
      const packageJson = await readFile(packageJsonPath, 'utf-8');
      const packageJsonObject = JSON.parse(packageJson);
      return import.meta.resolve(packageJsonObject.name, builderName);
    }
  } catch (e) {
    //
  }
  return import.meta.resolve(builderName, configDir);
}

export async function getPreviewBuilder(
  builderName: string,
  configDir: string
): Promise<Builder<unknown>> {
  const builderPackage = await resolveBuilderEntrypoint(builderName, configDir);
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
