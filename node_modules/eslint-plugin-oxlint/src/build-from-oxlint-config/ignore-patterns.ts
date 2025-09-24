import {
  EslintPluginOxlintConfig,
  OxlintConfig,
  OxlintConfigIgnorePatterns,
} from './types.js';

/**
 * adds the ignore patterns to the config
 */
export const handleIgnorePatternsScope = (
  ignorePatterns: OxlintConfigIgnorePatterns,
  config: EslintPluginOxlintConfig
): void => {
  config.ignores = ignorePatterns;
};
/**
 * tries to return the "ignorePattern" section from the config.
 * it returns `undefined` when not found or invalid.
 */
export const readIgnorePatternsFromConfig = (
  config: OxlintConfig
): OxlintConfigIgnorePatterns | undefined => {
  return 'ignorePatterns' in config && Array.isArray(config.ignorePatterns)
    ? config.ignorePatterns
    : undefined;
};
