import { cache } from 'storybook/internal/common';
import { buildStaticStandalone, withTelemetry } from 'storybook/internal/core-server';

export const build = async (cliOptions: any) => {
  const { default: packageJson } = await import('storybook/package.json', {
    with: { type: 'json' },
  });
  const options = {
    ...cliOptions,
    configDir: cliOptions.configDir || './.storybook',
    outputDir: cliOptions.outputDir || './storybook-static',
    siteUrl: cliOptions.siteUrl || undefined,
    ignorePreview: !!cliOptions.previewUrl && !cliOptions.forceBuildPreview,
    configType: 'PRODUCTION',
    cache,
    packageJson,
  };
  await withTelemetry('build', { cliOptions, presetOptions: options }, () =>
    buildStaticStandalone(options)
  );
};
