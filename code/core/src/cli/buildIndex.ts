import { cache } from '@storybook/core/common';

import { buildIndexStandalone, withTelemetry } from '@storybook/core/core-server';

import { findPackage } from 'fd-package-json';
import invariant from 'tiny-invariant';

export const buildIndex = async (cliOptions: any) => {
  const packageJson = await findPackage(__dirname);
  invariant(packageJson, 'Failed to find the closest package.json file.');
  const options = {
    ...cliOptions,
    configDir: cliOptions.configDir || './.storybook',
    outputFile: cliOptions.outputFile || './index.json',
    ignorePreview: true,
    configType: 'PRODUCTION',
    cache,
    packageJson,
  };
  await withTelemetry('index', { cliOptions, presetOptions: options }, () =>
    buildIndexStandalone(options)
  );
};
