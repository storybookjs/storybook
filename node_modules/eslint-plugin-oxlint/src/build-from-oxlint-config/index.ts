import { EslintPluginOxlintConfig, OxlintConfig } from './types.js';
import { handleRulesScope, readRulesFromConfig } from './rules.js';
import {
  defaultCategories,
  handleCategoriesScope,
  readCategoriesFromConfig,
} from './categories.js';
import { defaultPlugins, readPluginsFromConfig } from './plugins.js';
import {
  handleIgnorePatternsScope,
  readIgnorePatternsFromConfig,
} from './ignore-patterns.js';
import { handleOverridesScope, readOverridesFromConfig } from './overrides.js';
import { splitDisabledRulesForVueAndSvelteFiles } from '../config-helper.js';
import {
  handleExtendsScope,
  readExtendsConfigsFromConfig,
  resolveRelativeExtendsPaths,
} from './extends.js';
import { getConfigContent } from './utilities.js';
import path from 'node:path';

/**
 * builds turned off rules, which are supported by oxlint.
 * It accepts an object similar to the .oxlintrc.json file.
 */
export const buildFromOxlintConfig = (
  config: OxlintConfig
): EslintPluginOxlintConfig[] => {
  resolveRelativeExtendsPaths(config);

  const extendConfigs = readExtendsConfigsFromConfig(config);
  if (extendConfigs.length > 0) {
    handleExtendsScope(extendConfigs, config);
  }

  const rules: Record<string, 'off'> = {};
  const plugins = readPluginsFromConfig(config) ?? defaultPlugins;
  const categories = readCategoriesFromConfig(config) ?? defaultCategories;

  // it is not a plugin but it is activated by default
  plugins.push('eslint');

  // oxc handles "react-hooks" rules inside "react" plugin
  // our generator split them into own plugins
  if (plugins.includes('react')) {
    plugins.push('react-hooks');
  }

  handleCategoriesScope(plugins, categories, rules);

  const configRules = readRulesFromConfig(config);

  if (configRules !== undefined) {
    handleRulesScope(configRules, rules);
  }

  const baseConfig = {
    name: 'oxlint/from-oxlint-config',
    rules,
  };

  const ignorePatterns = readIgnorePatternsFromConfig(config);

  if (ignorePatterns !== undefined) {
    handleIgnorePatternsScope(ignorePatterns, baseConfig);
  }

  const overrides = readOverridesFromConfig(config);
  const configs = splitDisabledRulesForVueAndSvelteFiles(
    baseConfig
  ) as EslintPluginOxlintConfig[];

  if (overrides !== undefined) {
    handleOverridesScope(overrides, configs, categories);
  }

  return configs;
};

/**
 * builds turned off rules, which are supported by oxlint.
 * It accepts an filepath to the .oxlintrc.json file.
 *
 * It the .oxlintrc.json file could not be found or parsed,
 * no rules will be deactivated and an error to `console.error` will be emitted
 */
export const buildFromOxlintConfigFile = (
  oxlintConfigFile: string
): EslintPluginOxlintConfig[] => {
  const config = getConfigContent(oxlintConfigFile);

  // we could not parse form the file, do not build with default values
  // we can not be sure if the setup is right
  if (config === undefined) {
    return [];
  }

  config.__misc = {
    filePath: path.resolve(oxlintConfigFile),
  };

  return buildFromOxlintConfig(config);
};
