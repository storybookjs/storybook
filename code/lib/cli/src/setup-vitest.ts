import { findPackage } from 'fd-package-json';
import { setupVitestAddon, withTelemetry } from '@storybook/core/core-server';
import { cache } from '@storybook/core/common';
import invariant from 'tiny-invariant';

export const setupVitest = async (cliOptions: any) => {
  const packageJson = await findPackage(__dirname);
  invariant(packageJson, 'Failed to find the closest package.json file.');

  const options = {
    ...cliOptions,
    configDir: cliOptions.configDir || './.storybook',
    ignorePreview: !!cliOptions.previewUrl && !cliOptions.forceBuildPreview,
    cache,
    packageJson,
  };
  // TODO: Discuss about telemetry
  // await withTelemetry('setup-vitest', { cliOptions, presetOptions: options }, () =>
  setupVitestAddon(options);
  // );
};
