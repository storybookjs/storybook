import chalk from 'chalk';
import { dedent } from 'ts-dedent';

import type { Fix } from '../types';
import { updateMainConfig } from '../helpers/mainConfigFile';

const logger = console;

interface AutodocsTrueFrameworkRunOptions {
  value?: boolean | 'tag';
}

/**
 * Set the docs.autodocs option to true if it isn't already set
 */
export const autodocsTrue: Fix<AutodocsTrueFrameworkRunOptions> = {
  id: 'autodocsTrue',

  versionRange: ['<7', '>=7'],

  async check({ mainConfig }) {
    const { docs } = mainConfig;

    const docsPageToAutodocsMapping = {
      true: 'tag' as const,
      automatic: true,
      false: false,
    };

    // @ts-expect-error docsPage does not exist anymore but we need to account for legacy code
    if (docs?.docsPage) {
      // @ts-expect-error same as above
      const oldValue = docs?.docsPage.toString();
      if (!(oldValue in docsPageToAutodocsMapping)) {
        throw new Error(`Unexpected value for docs.docsPage: ${oldValue}`);
      }

      return {
        value: docsPageToAutodocsMapping[oldValue as keyof typeof docsPageToAutodocsMapping],
      };
    }

    return docs?.autodocs === undefined ? { value: true } : null;
  },

  prompt({ value }) {
    const autodocsFormatted = chalk.cyan(`docs: { autodocs: ${JSON.stringify(value ?? true)} }`);
    const tagWarning = dedent`
      NOTE: if you're upgrading from an older 7.0-beta using the 'docsPage' tag,
      please update your story files to use the 'autodocs' tag instead.
    `;

    if (value) {
      return dedent`
      We've changed the configuration of autodocs (previous docsPage), so now the value:
        - docs.autodocs: true -- means automatically create docs for every CSF file
        - docs.autodocs: 'tag' -- means only create autodocs for CSF files with the 'autodocs' tag
        - docs.autodocs: false -- means never create autodocs

      Based on your prior configuration,  we can set the \`docs.autodocs\` to keep your old behaviour:

      ${autodocsFormatted}
      ${value === 'tag' ? tagWarning : ''}
      More info: ${chalk.yellow(
        'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#autodocs-changes'
      )}
    `;
    }

    return dedent`
      We've detected that your main.js configuration file has not configured autodocs. In 6.x we
      we defaulted to having a autodocs for every story, in 7.x you need to opt in per-component.
      However, we can set the \`docs.autodocs\` to true to approximate the old behaviour:

      ${autodocsFormatted}

      More info: ${chalk.yellow(
        'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#autodocs-changes'
      )}
    `;
  },

  async run({ result: { value }, dryRun, mainConfigPath }) {
    logger.info(`✅ Setting 'docs.autodocs' to true in main.js`);
    if (!dryRun) {
      await updateMainConfig({ mainConfigPath, dryRun: !!dryRun }, async (main) => {
        main.removeField(['docs', 'docsPage']);
        main.setFieldValue(['docs', 'autodocs'], value ?? true);
      });
    }
  },
};
