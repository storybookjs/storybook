import { logger } from 'storybook/internal/node-logger';

interface Options {
  hasTSDependency: boolean;
}

export const warn = async ({ hasTSDependency }: Options) => {
  if (!hasTSDependency) {
    // Dynamically import globby because it is a pure ESM module
    // eslint-disable-next-line depend/ban-dependencies
    const { globby } = await import('globby');

    const files = await globby(['**/*.@(ts|tsx)', '!**/node_modules', '!**/*.d.ts']);

    const hasTSFiles = !!files.length;

    if (hasTSFiles) {
      logger.warn(
        'We have detected TypeScript files in your project directory, however TypeScript is not listed as a project dependency.'
      );
      logger.warn('Storybook will continue as though this is a JavaScript project.');
      logger.line();
      logger.info(
        'For more information, see: https://storybook.js.org/docs/configurations/typescript-config/'
      );
    }
  }
};
