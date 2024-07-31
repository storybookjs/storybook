import path from 'node:path';
import type { Options } from '@storybook/core/types';
import { extractProperRendererNameFromFramework, getFrameworkName } from '@storybook/core/common';

interface PropertyObject {
  name: string;
  options?: Record<string, any>;
}

type Property = string | PropertyObject | undefined;

export const pluckNameFromConfigProperty = (property: Property) => {
  if (!property) {
    return undefined;
  }

  return typeof property === 'string' ? property : property.name;
};

// For replacing Windows backslashes with forward slashes
const normalizePath = (packagePath: string) => packagePath.replaceAll(path.sep, '/');

export const pluckStorybookPackageFromPath = (packagePath: string) =>
  normalizePath(packagePath).match(/(@storybook\/.*)$/)?.[1];

export const pluckThirdPartyPackageFromPath = (packagePath: string) =>
  normalizePath(packagePath).split('node_modules/')[1] ?? packagePath;

export const buildFrameworkGlobalsFromOptions = async (options: Options) => {
  const globals: Record<string, any> = {};

  const { builder } = await options.presets.apply('core');

  const frameworkName = await getFrameworkName(options);
  const rendererName = await extractProperRendererNameFromFramework(frameworkName);

  if (rendererName) {
    globals.STORYBOOK_RENDERER =
      (await extractProperRendererNameFromFramework(frameworkName)) ?? undefined;
  }

  const builderName = pluckNameFromConfigProperty(builder);
  if (builderName) {
    globals.STORYBOOK_BUILDER =
      pluckStorybookPackageFromPath(builderName) ?? pluckThirdPartyPackageFromPath(builderName);
  }

  const framework = pluckNameFromConfigProperty(await options.presets.apply('framework'));
  if (framework) {
    globals.STORYBOOK_FRAMEWORK = framework;
  }

  return globals;
};
