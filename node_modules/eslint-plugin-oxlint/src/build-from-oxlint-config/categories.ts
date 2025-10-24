import { aliasPluginNames } from '../constants.js';
import configByCategory from '../generated/configs-by-category.js';
import {
  OxlintConfig,
  OxlintConfigCategories,
  OxlintConfigPlugins,
} from './types.js';
import { isObject } from './utilities.js';

// default categories, see <https://github.com/oxc-project/oxc/blob/0acca58/crates/oxc_linter/src/builder.rs#L82>
export const defaultCategories: OxlintConfigCategories = {
  correctness: 'warn',
};

/**
 * appends all rules which are enabled by a plugin and falls into a specific category
 */
export const handleCategoriesScope = (
  plugins: OxlintConfigPlugins,
  categories: OxlintConfigCategories,
  rules: Record<string, 'off'>
): void => {
  for (const category in categories) {
    const configName = `flat/${category}`;

    // category is not enabled or not in found categories
    if (categories[category] === 'off' || !(configName in configByCategory)) {
      continue;
    }

    // @ts-expect-error -- come on TS, we are checking if the configName exists in the configByCategory
    const possibleRules = configByCategory[configName].rules;

    // iterate to each rule to check if the rule can be appended, because the plugin is activated
    for (const rule of Object.keys(possibleRules)) {
      for (const plugin of plugins) {
        const pluginPrefix =
          plugin in aliasPluginNames ? aliasPluginNames[plugin] : plugin;

        // the rule has no prefix, so it is a eslint one
        if (pluginPrefix === '' && !rule.includes('/')) {
          rules[rule] = 'off';
          // other rules with a prefix like @typescript-eslint/
        } else if (rule.startsWith(`${pluginPrefix}/`)) {
          rules[rule] = 'off';
        }
      }
    }
  }
};

/**
 * tries to return the "categories" section from the config.
 * it returns `undefined` when not found or invalid.
 */
export const readCategoriesFromConfig = (
  config: OxlintConfig
): OxlintConfigCategories | undefined => {
  return 'categories' in config && isObject(config.categories)
    ? (config.categories as OxlintConfigCategories)
    : undefined;
};
