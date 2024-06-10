import { dedent } from 'ts-dedent';
import { getRendererName, updateMainConfig } from '../helpers/mainConfigFile';
import type { Fix } from '../types';
import chalk from 'chalk';

const logger = console;

interface Options {
  reactDocgenTypescriptOptions?: any;
  reactDocgen?: 'react-docgen-typescript' | 'react-docgen' | false;
}

export const reactDocgen: Fix<Options> = {
  id: 'react-docgen',

  versionRange: ['<8.0.0-alpha.1', '>=8.0.0-alpha.1'],

  async check({ mainConfig }) {
    // @ts-expect-error assume react
    const { reactDocgenTypescriptOptions, reactDocgen: rDocgen } = mainConfig.typescript || {};

    const rendererName = getRendererName(mainConfig);

    if (rendererName !== 'react' || rDocgen !== undefined) {
      return null;
    }

    return { reactDocgenTypescriptOptions, reactDocgen: rDocgen };
  },

  prompt({ reactDocgenTypescriptOptions }) {
    if (reactDocgenTypescriptOptions) {
      return dedent`
      You have "typescript.reactDocgenTypescriptOptions" configured in your main.js,
      but "typescript.reactDocgen" is unset.
      
      Since Storybook 8.0, we changed the default React docgen analysis from 
      "react-docgen-typescript" to "react-docgen". We recommend "react-docgen"
      for most projects, since it is dramatically faster. However, it doesn't
      handle all TypeScript constructs, and may generate different results
      than "react-docgen-typescript".
      
      Should we update your config to continue to use "react-docgen-typescript"?

      https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#react-docgen-component-analysis-by-default
    `;
    } else {
      return dedent`
      Since Storybook 8.0, ${chalk.cyan(
        'react-docgen'
      )} is now the default for generating component controls, replacing ${chalk.cyan(
        'react-docgen-typescript'
      )}. 
      This offers better performance and suits most cases. 
      However, for complex TypeScript types or specific type features, the generated controls might not be as precise.
      
      For more on this change, check the migration guide: 
      ${chalk.yellow(
        'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#react-docgen-component-analysis-by-default'
      )}
      
      For known "react-docgen" limitations, see: 
      ${chalk.yellow('https://github.com/storybookjs/storybook/issues/26606')}
      
      Press Y to revert to ${chalk.cyan('react-docgen-typescript')}, press N to use ${chalk.cyan(
        'react-docgen'
      )}
    `;
    }
  },

  async run({ dryRun, mainConfigPath, result }) {
    if (!dryRun) {
      await updateMainConfig({ mainConfigPath, dryRun: !!dryRun }, async (main) => {
        logger.info(`✅ Setting typescript.reactDocgen`);
        main.setFieldValue(['typescript', 'reactDocgen'], 'react-docgen-typescript');
      });
    }
  },
};
