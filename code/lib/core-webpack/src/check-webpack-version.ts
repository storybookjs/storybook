import { logger } from 'storybook/internal/node-logger';
import { dedent } from 'ts-dedent';

export const checkWebpackVersion = (
  webpack: { version?: string },
  specifier: string,
  caption: string
) => {
  if (!webpack.version) {
    logger.info('Skipping webpack version check, no version available');
    return;
  }
  if (webpack.version !== specifier) {
    logger.warn(dedent`
      Unexpected webpack version in ${caption}:
      - Received '${webpack.version}'
      - Expected '${specifier}'

      If you're using Webpack 5 in SB6.2 and upgrading, consider: https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#webpack-5-manager-build

      For more info about Webpack 5 support: https://gist.github.com/shilman/8856ea1786dcd247139b47b270912324#troubleshooting
    `);
  }
};
