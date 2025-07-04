import type { Configuration } from 'webpack';

export function configureNextFont(baseConfig: Configuration, isSWC?: boolean) {
  const fontLoaderPath = require.resolve(
    '@storybook/experimental-nextjs-rsc/font/webpack/loader/storybook-nextjs-font-loader'
  );

  if (isSWC) {
    baseConfig.module?.rules?.push({
      test: /next(\\|\/|\\\\).*(\\|\/|\\\\)target\.css$/,
      loader: fontLoaderPath,
    });
  } else {
    baseConfig.resolveLoader = {
      ...baseConfig.resolveLoader,
      alias: {
        ...baseConfig.resolveLoader?.alias,
        'storybook-nextjs-font-loader': fontLoaderPath,
      },
    };
  }
}
