import { loadConfig } from 'tsconfig-paths';
import TsconfigPathsPlugin from 'tsconfig-paths-webpack-plugin';
import type { Configuration as WebpackConfig } from 'webpack';

export const configureImports = ({
  baseConfig,
  configDir,
}: {
  baseConfig: WebpackConfig;
  configDir: string;
}): void => {
  const configLoadResult = loadConfig(configDir);

  if (configLoadResult.resultType === 'failed') {
    // either not a typescript project or tsconfig is not found - we bail
    return;
  }

  baseConfig.resolve ??= {};
  baseConfig.resolve.plugins ??= [];

  baseConfig.resolve.plugins.push(
    new TsconfigPathsPlugin({
      configFile: configLoadResult.configFileAbsolutePath,
      extensions: ['.js', '.jsx', '.ts', '.tsx'],
    }) as any
  );
};
