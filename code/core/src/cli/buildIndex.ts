import { cache } from 'storybook/internal/common';
import { buildIndexStandalone, withTelemetry } from 'storybook/internal/core-server';
import type { BuilderOptions, CLIBaseOptions } from 'storybook/internal/types';

export interface CLIIndexOptions extends CLIBaseOptions {
  configDir?: string;
  outputFile?: string;
}

export const buildIndex = async (
  cliOptions: CLIIndexOptions & { packageJson?: Record<string, any> }
) => {
  const options = {
    ...cliOptions,
    configDir: cliOptions.configDir || '.storybook',
    outputFile: cliOptions.outputFile || 'index.json',
    ignorePreview: true,
    configType: 'PRODUCTION' as BuilderOptions['configType'],
    cache,
    packageJson: cliOptions.packageJson,
  };
  const presetOptions = {
    ...options,
    corePresets: [],
    overridePresets: [],
  };
  await withTelemetry('index', { cliOptions, presetOptions }, () => buildIndexStandalone(options));
};
