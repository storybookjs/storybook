import webpackConfig from '../preview/iframe-webpack.config';

export const webpack = async (_: unknown, options: any) => webpackConfig(options);

export const entries = async (_: unknown, options: any) => {
  let result: string[] = [];

  if (options.configType === 'DEVELOPMENT') {
    // Suppress informational messages when --quiet is specified. webpack-hot-middleware's quiet
    // parameter would also suppress warnings.
    result = result.concat(
      `${require.resolve(
        'webpack-hot-middleware/client'
      )}?reload=true&quiet=false&overlay=${JSON.stringify({
        errors: true,
        warnings: false,
        runtimeErrors: false,
      })}&noInfo=${options.quiet}`
    );
  }

  return result;
};

export const previewMainTemplate = () =>
  require.resolve('@storybook/builder-webpack5/templates/preview.ejs');
