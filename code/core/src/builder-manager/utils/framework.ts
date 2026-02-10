import {
  extractFrameworkPackageName,
  frameworkPackages,
  frameworkToRenderer,
  getFrameworkName,
} from 'storybook/internal/common';
import { type Options, SupportedBuilder } from 'storybook/internal/types';

export const buildFrameworkGlobalsFromOptions = async (options: Options) => {
  const globals: Record<string, any> = {};

  const { builder: builderConfig, channelOptions } = await options.presets.apply('core');
  const builderName = typeof builderConfig === 'string' ? builderConfig : builderConfig?.name;
  const builder = Object.values(SupportedBuilder).find((builder) => builderName?.includes(builder));

  const frameworkName = await getFrameworkName(options);
  const frameworkPackageName = extractFrameworkPackageName(frameworkName);
  const framework = frameworkPackages[frameworkPackageName];
  const renderer = frameworkToRenderer[framework];

  // Manager only needs the token currently, so we don't pass any other channel options.
  globals.CHANNEL_OPTIONS = { wsToken: channelOptions.wsToken };
  globals.STORYBOOK_BUILDER = builder;
  globals.STORYBOOK_FRAMEWORK = framework;
  globals.STORYBOOK_RENDERER = renderer;
  globals.STORYBOOK_NETWORK_ADDRESS = options.networkAddress;

  return globals;
};
