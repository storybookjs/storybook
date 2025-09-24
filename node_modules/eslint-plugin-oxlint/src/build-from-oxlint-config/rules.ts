import {
  aliasPluginNames,
  reactHookRulesInsideReactScope,
} from '../constants.js';
import {
  OxlintConfig,
  OxlintConfigOverride,
  OxlintConfigRules,
} from './types.js';
import configByCategory from '../generated/configs-by-category.js';
import { isObject } from './utilities.js';

const allRulesObjects = Object.values(configByCategory).map(
  (config) => config.rules
);
const allRules: string[] = allRulesObjects.flatMap((rulesObject) =>
  Object.keys(rulesObject)
);

const getEsLintRuleName = (rule: string): string | undefined => {
  // there is no plugin prefix, it can be all plugin
  if (!rule.includes('/')) {
    return allRules.find(
      (search) => search.endsWith(`/${rule}`) || search === rule
    );
  }

  // greedy works with `@next/next/no-img-element` as an example
  const match = rule.match(/(^.*)\/(.*)/);

  if (match === null) {
    return undefined;
  }

  const pluginName = match[1];
  const ruleName = match[2];

  // map to the right eslint plugin
  let esPluginName =
    pluginName in aliasPluginNames ? aliasPluginNames[pluginName] : pluginName;

  // special case for eslint-plugin-react-hooks
  if (
    esPluginName === 'react' &&
    reactHookRulesInsideReactScope.includes(ruleName)
  ) {
    esPluginName = 'react-hooks';
  }

  // extra check for eslint
  const expectedRule =
    esPluginName === '' ? ruleName : `${esPluginName}/${ruleName}`;

  return allRules.find((rule) => rule === expectedRule);
};

/**
 * checks if value is validSet, or if validSet is an array, check if value is first value of it
 */
const isValueInSet = (value: unknown, validSet: unknown[]) =>
  validSet.includes(value) ||
  (Array.isArray(value) && validSet.includes(value[0]));

/**
 * check if the value is "off", 0, ["off", ...], or [0, ...]
 */
const isDeactivateValue = (value: unknown) => isValueInSet(value, ['off', 0]);

/**
 * check if the value is "error", "warn", 1, 2, ["error", ...], ["warn", ...], [1, ...], or [2, ...]
 */
const isActiveValue = (value: unknown) =>
  isValueInSet(value, ['error', 'warn', 1, 2]);

/**
 * checks if the oxlint rule is activated/deactivated and append/remove it.
 */
export const handleRulesScope = (
  oxlintRules: OxlintConfigRules,
  rules: Record<string, 'off'>
): void => {
  for (const rule in oxlintRules) {
    const eslintName = getEsLintRuleName(rule);

    if (eslintName === undefined) {
      continue;
    }

    // is this rules not turned off
    if (isActiveValue(oxlintRules[rule])) {
      rules[eslintName] = 'off';
    } else if (rule in rules && isDeactivateValue(oxlintRules[rule])) {
      // rules extended by categories or plugins can be disabled manually
      delete rules[eslintName];
    }
  }
};

/**
 * tries to return the "rules" section from the config.
 * it returns `undefined` when not found or invalid.
 */
export const readRulesFromConfig = (
  config: OxlintConfig | OxlintConfigOverride
): OxlintConfigRules | undefined => {
  return 'rules' in config && isObject(config.rules)
    ? (config.rules as OxlintConfigRules)
    : undefined;
};
