import type { Configuration } from 'webpack';

export function configureNextFont(baseConfig: Configuration, isSWC?: boolean) {
  if (isSWC) {
    baseConfig.module?.rules?.push({
      test: /next(\\|\/|\\\\).*(\\|\/|\\\\)target\.css$/,
      loader: '@storybook/nextjs/storybook-nextjs-font-loader',
    });
  } else {
    baseConfig.resolveLoader = {
      ...baseConfig.resolveLoader,
      alias: {
        ...baseConfig.resolveLoader?.alias,
        'storybook-nextjs-font-loader': '@storybook/nextjs/storybook-nextjs-font-loader',
      },
    };
  }
}
