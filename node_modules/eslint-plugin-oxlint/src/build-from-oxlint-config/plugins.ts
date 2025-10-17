import {
  OxlintConfig,
  OxlintConfigOverride,
  OxlintConfigPlugins,
} from './types.js';

// default plugins, see <https://oxc.rs/docs/guide/usage/linter/config#plugins>
export const defaultPlugins: OxlintConfigPlugins = ['unicorn', 'typescript'];

/**
 * tries to return the "plugins" section from the config.
 * it returns `undefined` when not found or invalid.
 */
export const readPluginsFromConfig = (
  config: OxlintConfig | OxlintConfigOverride
): OxlintConfigPlugins | undefined => {
  return 'plugins' in config && Array.isArray(config.plugins)
    ? config.plugins
    : undefined;
};
