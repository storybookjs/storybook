import type { Configuration } from 'webpack';

export function configureNextFont(baseConfig: Configuration) {
  baseConfig.module?.rules?.push({
    test: /next(\\|\/|\\\\).*(\\|\/|\\\\)target\.css$/,
    loader: '@storybook/nextjs/storybook-nextjs-font-loader',
  });
}
