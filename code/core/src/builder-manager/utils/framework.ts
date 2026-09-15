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

  // The manager sits on the other end of the same postMessage channel as the preview, so it
  // has to serialize the events it emits (e.g. UPDATE_STORY_ARGS) with the same telejson
  // options. Otherwise `core.channelOptions` is ignored for manager -> preview events and
  // deeply nested args get truncated at the default maxDepth. See #24818.
  globals.CHANNEL_OPTIONS = {
    ...channelOptions,
    // The websocket channel only exists in development, and so does its token.
    wsToken: options.configType === 'DEVELOPMENT' ? channelOptions?.wsToken : undefined,
  };
  globals.STORYBOOK_BUILDER = builder;
  globals.STORYBOOK_FRAMEWORK = framework;
  globals.STORYBOOK_RENDERER = renderer;
  globals.STORYBOOK_NETWORK_ADDRESS = options.networkAddress;

  return globals;
};
