import { handleCategoriesScope } from './categories.js';
import { readPluginsFromConfig } from './plugins.js';
import { handleRulesScope, readRulesFromConfig } from './rules.js';
import {
  EslintPluginOxlintConfig,
  OxlintConfig,
  OxlintConfigCategories,
  OxlintConfigOverride,
} from './types.js';

export const handleOverridesScope = (
  overrides: OxlintConfigOverride[],
  configs: EslintPluginOxlintConfig[],
  baseCategories?: OxlintConfigCategories
): void => {
  for (const [overrideIndex, override] of overrides.entries()) {
    const eslintRules: Record<string, 'off'> = {};
    const eslintConfig: EslintPluginOxlintConfig = {
      name: `oxlint/from-oxlint-config-override-${overrideIndex}`,
    };

    // expect that oxlint `files` syntax is the same as eslint
    eslintConfig.files = override.files;

    const plugins = readPluginsFromConfig(override);
    if (baseCategories !== undefined && plugins !== undefined) {
      handleCategoriesScope(plugins, baseCategories, eslintRules);
    }

    const rules = readRulesFromConfig(override);
    if (rules !== undefined) {
      handleRulesScope(rules, eslintRules);
    }

    eslintConfig.rules = eslintRules;
    configs.push(eslintConfig);
  }
};

export const readOverridesFromConfig = (
  config: OxlintConfig
): OxlintConfigOverride[] | undefined => {
  return 'overrides' in config && Array.isArray(config.overrides)
    ? (config.overrides as OxlintConfigOverride[])
    : undefined;
};
