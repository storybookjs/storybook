import { findPackageSync } from 'fd-package-json';
import { buildStaticStandalone, withTelemetry } from '@storybook/core-server';
import { cache } from '@storybook/core-common';
import invariant from 'tiny-invariant';

export const build = async (cliOptions: any) => {
  const packageJson = findPackageSync(__dirname);
  invariant(packageJson, 'Failed to find the closest package.json file.');
  const options = {
    ...cliOptions,
    configDir: cliOptions.configDir || './.storybook',
    outputDir: cliOptions.outputDir || './storybook-static',
    ignorePreview: !!cliOptions.previewUrl && !cliOptions.forceBuildPreview,
    configType: 'PRODUCTION',
    cache,
    packageJson,
  };
  await withTelemetry('build', { cliOptions, presetOptions: options }, () =>
    buildStaticStandalone(options)
  );
};
