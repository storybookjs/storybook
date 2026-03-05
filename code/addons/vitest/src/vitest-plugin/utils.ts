import { readFileSync } from 'node:fs';

import type { ViteUserConfig } from 'vitest/config';

import { CLI_COLORS, logger } from 'storybook/internal/node-logger';

import { dirname, resolve } from 'pathe';
import { dedent } from 'ts-dedent';

import type { InternalOptions } from './types';

let hasLoggedDeprecationWarning = false;

const logBoxOnce = (message: string) => {
  if (!hasLoggedDeprecationWarning) {
    logger.logBox(message);
    hasLoggedDeprecationWarning = true;
  }
};

export async function requiresProjectAnnotations(
  testConfig: ViteUserConfig['test'] | undefined,
  finalOptions: InternalOptions,
  isCSF4: boolean
) {
  const setupFiles = Array.isArray(testConfig?.setupFiles)
    ? testConfig.setupFiles
    : typeof testConfig?.setupFiles === 'string'
      ? [testConfig.setupFiles]
      : [];

  const userSetupFiles = setupFiles
    .map((setupFile) => {
      try {
        return resolve(finalOptions.vitestRoot, setupFile);
      } catch (e) {
        return null;
      }
    })
    .filter(Boolean) as string[];

  const hasStorybookAnnotations = userSetupFiles.find((setupFile) => {
    const hasStorybookSetupFileName = dirname(setupFile) === finalOptions.configDir;

    if (!hasStorybookSetupFileName) {
      return false;
    }

    // Check if the file contains setProjectAnnotations
    const setupFileContent = readFileSync(setupFile, 'utf-8');
    return setupFileContent.includes('setProjectAnnotations');
  });

  if (hasStorybookAnnotations) {
    logBoxOnce(dedent`
      ${CLI_COLORS.warning('Warning')}: Found a setup file with "setProjectAnnotations".
      Skipping automatic provision to avoid conflicts. Since Storybook 10.3, "@storybook/addon-vitest" applies these automatically.
      You can safely remove your vitest.setup file and its "test.setupFiles" reference.
    `);

    return false;
  } else if (isCSF4) {
    return false;
  }

  return true;
}
