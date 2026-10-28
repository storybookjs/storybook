import {
  extractFrameworkPackageName,
  frameworkPackages,
  frameworkToRenderer,
  getFrameworkNameFromConfig,
} from '@storybook/core/internal/common';
import {
  type CoreConfig,
  type Options,
  type SecurityConfig,
  SupportedBuilder,
} from '@storybook/core/internal/types';

export const buildFrameworkGlobalsFromOptions = async (options: Options) => {
  const frameworkName = getFrameworkNameFromConfig(
    await options.presets.apply('framework', '', options)
  );
  if (!frameworkName) {
    throw new Error("You must specify a framework in '.storybook/main.js' config.");
  }
  return buildFrameworkGlobals(
    options,
    await options.presets.apply('core'),
    frameworkName,
    await options.presets.apply<SecurityConfig | undefined>('security')
  );
};

export function buildFrameworkGlobals(
  options: Pick<Options, 'configType' | 'host' | 'networkAddress'>,
  { builder: builderConfig, channelOptions }: CoreConfig,
  frameworkName: string,
  security: SecurityConfig | undefined
): Record<string, unknown> {
  const globals: Record<string, unknown> = {};
  const builderName = typeof builderConfig === 'string' ? builderConfig : builderConfig?.name;
  const builder = Object.values(SupportedBuilder).find((builder) => builderName?.includes(builder));

  const frameworkPackageName = extractFrameworkPackageName(frameworkName);
  const framework = frameworkPackages[frameworkPackageName];
  const renderer = frameworkToRenderer[framework];

  if (options.configType === 'DEVELOPMENT') {
    // Manager only needs the token currently, so we don't pass any other channel options.
    globals.CHANNEL_OPTIONS = { wsToken: channelOptions?.wsToken };
  }
  globals.STORYBOOK_BUILDER = builder;
  globals.STORYBOOK_FRAMEWORK = framework;
  globals.STORYBOOK_RENDERER = renderer;
  globals.STORYBOOK_NETWORK_ADDRESS = options.host ? options.networkAddress : undefined;

  if (security?.insecureIframeMessaging) {
    globals.INSECURE_IFRAME_MESSAGING = true;
  }

  return globals;
}
