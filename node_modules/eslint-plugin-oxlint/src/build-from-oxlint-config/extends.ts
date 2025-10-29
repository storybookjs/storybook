import path from 'node:path';
import type {
  OxlintConfig,
  OxlintConfigOverride,
  OxlintConfigPlugins,
  OxlintConfigRules,
  OxlintConfigExtends,
} from './types.js';
import { getConfigContent } from './utilities.js';
import { defaultPlugins, readPluginsFromConfig } from './plugins.js';
import { readRulesFromConfig } from './rules.js';
import { readOverridesFromConfig } from './overrides.js';

/**
 * tries to return the "extends" section from the config.
 * it returns `undefined` when not found or invalid.
 */
const readExtendsFromConfig = (
  config: OxlintConfig
): OxlintConfigExtends | undefined => {
  return 'extends' in config && Array.isArray(config.extends)
    ? config.extends
    : undefined;
};

/**
 * Resolves the paths of the "extends" section relative to the given config file.
 */
export const resolveRelativeExtendsPaths = (config: OxlintConfig) => {
  if (!config.__misc?.filePath) {
    return;
  }

  const extendsFiles = readExtendsFromConfig(config);
  if (!extendsFiles?.length) return;
  const configFileDirectory = path.dirname(config.__misc.filePath);
  config.extends = extendsFiles.map((extendFile) =>
    path.resolve(configFileDirectory, extendFile)
  );
};

/**
 * Appends plugins, rules and overrides from the extends configs files to the given config.
 */
export const handleExtendsScope = (
  extendsConfigs: OxlintConfig[],
  config: OxlintConfig
) => {
  let rules: OxlintConfigRules = readRulesFromConfig(config) ?? {};
  const plugins: OxlintConfigPlugins = readPluginsFromConfig(config) ?? [];
  const overrides: OxlintConfigOverride[] =
    readOverridesFromConfig(config) ?? [];
  for (const extendConfig of extendsConfigs) {
    plugins.unshift(...(readPluginsFromConfig(extendConfig) ?? defaultPlugins));
    rules = { ...readRulesFromConfig(extendConfig), ...rules };
    overrides.unshift(...(readOverridesFromConfig(extendConfig) ?? []));
  }
  if (plugins.length > 0) config.plugins = [...new Set(plugins)];
  if (Object.keys(rules).length > 0) config.rules = rules;
  if (overrides.length > 0) config.overrides = overrides;
};

/**
 * tries to return the content of the chain "extends" section from the config.
 */
export const readExtendsConfigsFromConfig = (
  config: OxlintConfig
): OxlintConfig[] => {
  const extendsFiles = readExtendsFromConfig(config);
  if (!extendsFiles?.length) return [];

  const extendsConfigs: OxlintConfig[] = [];
  for (const file of extendsFiles) {
    const extendConfig = getConfigContent(file);
    if (!extendConfig) continue;

    extendConfig.__misc = {
      filePath: file,
    };

    resolveRelativeExtendsPaths(extendConfig);

    extendsConfigs.push(
      extendConfig,
      ...readExtendsConfigsFromConfig(extendConfig)
    );
  }
  return extendsConfigs;
};
