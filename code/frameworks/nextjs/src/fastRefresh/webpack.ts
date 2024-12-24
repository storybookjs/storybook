import ReactRefreshWebpackPlugin from '@pmmmwh/react-refresh-webpack-plugin';
import type { Configuration as WebpackConfig } from 'webpack';

export const configureFastRefresh = (baseConfig: WebpackConfig): void => {
  baseConfig.plugins = [
    ...(baseConfig.plugins ?? []),
    // overlay is disabled as it is shown with caught errors in error boundaries
    // and the next app router is using error boundaries to redirect
    // TODO use the Next error overlay
    new ReactRefreshWebpackPlugin({ overlay: false }),
  ];
};
