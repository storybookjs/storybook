import { rulesDisabledForVueAndSvelteFiles } from './constants.js';
import type { Linter } from 'eslint';

// for eslint legacy configuration
export const overrideDisabledRulesForVueAndSvelteFiles = (
  config: Linter.LegacyConfig<Record<string, 'off'>>
): Linter.LegacyConfig<Record<string, 'off'>> => {
  const foundRules = Object.keys(config.rules!).filter((rule) =>
    rulesDisabledForVueAndSvelteFiles.includes(rule)
  );

  if (foundRules.length === 0) {
    return config;
  }

  const newConfig = structuredClone(config);

  newConfig.overrides = [
    {
      // classic configs use glob syntax
      files: ['*.*'],
      excludedFiles: ['*.vue', '*.svelte'],
      rules: {},
    },
  ];

  for (const rule of foundRules) {
    delete newConfig.rules![rule];
    newConfig.overrides[0].rules![rule] = 'off';
  }

  return newConfig;
};

// for eslint flat configuration
export const splitDisabledRulesForVueAndSvelteFiles = (
  config: Linter.Config
): Linter.Config[] => {
  const foundRules = Object.keys(config.rules!).filter((rule) =>
    rulesDisabledForVueAndSvelteFiles.includes(rule)
  );

  if (foundRules.length === 0) {
    return [config];
  }

  const oldConfig = structuredClone(config);

  const newConfig: Linter.Config = {
    // flat configs use minimatch syntax
    name: 'oxlint/vue-svelte-exceptions',
    ignores: ['**/*.vue', '**/*.svelte'],
    rules: {},
  };

  for (const rule of foundRules) {
    delete oldConfig.rules![rule];
    newConfig.rules![rule] = 'off';
  }

  return [oldConfig, newConfig];
};
