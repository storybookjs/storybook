import fs from 'node:fs';
import JSONCParser from 'jsonc-parser';
import { OxlintConfig } from './types.js';

/**
 * Detects it the value is an object
 */
export const isObject = (value: unknown): boolean =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * tries to read the oxlint config file and returning its JSON content.
 * if the file is not found or could not be parsed, undefined is returned.
 * And an error message will be emitted to `console.error`
 */
export const getConfigContent = (
  oxlintConfigFile: string
): OxlintConfig | undefined => {
  try {
    const content = fs.readFileSync(oxlintConfigFile, 'utf8');

    try {
      const configContent = JSONCParser.parse(content);

      if (!isObject(configContent)) {
        throw new TypeError('not an valid config file');
      }

      return configContent;
    } catch {
      console.error(
        `eslint-plugin-oxlint: could not parse oxlint config file: ${oxlintConfigFile}`
      );
      return undefined;
    }
  } catch {
    console.error(
      `eslint-plugin-oxlint: could not find oxlint config file: ${oxlintConfigFile}`
    );
    return undefined;
  }
};
