import { type JsPackageManager, syncStorybookAddons } from 'storybook/internal/common';
import { logger, prompt } from 'storybook/internal/node-logger';

import picocolors from 'picocolors';
import { dedent } from 'ts-dedent';

import { runCodemod } from '../automigrate/codemod';
import { getFrameworkPackageName } from '../automigrate/helpers/mainConfigFile';
import type { CommandFix } from '../automigrate/types';
import { configToCsfFactory } from './helpers/config-to-csf-factory';
import { storyToCsfFactory } from './helpers/story-to-csf-factory';

async function runStoriesCodemod(options: {
  dryRun: boolean | undefined;
  packageManager: JsPackageManager;
  useSubPathImports: boolean;
  previewConfigPath: string;
}) {
  const { dryRun, packageManager, ...codemodOptions } = options;
  try {
    let globString = '{stories,src}/**/{Button,Header,Page}.stories.*';
    if (!process.env.IN_STORYBOOK_SANDBOX) {
      logger.log('Please enter the glob for your stories to migrate');
      globString = await prompt.text({
        message: 'glob',
        initialValue: 'src/**/*.stories.*',
      });
    }

    logger.log('\n🛠️  Applying codemod on your stories, this might take some time...');

    const command = packageManager.getRemoteRunCommand('storybook', [
      'migrate',
      'csf-2-to-3',
      '--glob',
      globString,
    ]);

    // TODO: Move the csf-2-to-3 codemod into automigrations
    await packageManager.executeCommand({
      command: command[0],
      args: command.slice(1),
      stdio: 'ignore',
      ignoreError: true,
    });

    await runCodemod(globString, (info) => storyToCsfFactory(info, codemodOptions), {
      dryRun,
    });
  } catch (err: any) {
    if (err.message === 'No files matched') {
      await runStoriesCodemod(options);
    } else {
      throw err;
    }
  }
}

export const csfFactories: CommandFix = {
  id: 'csf-factories',
  promptType: 'command',
  async run({ dryRun, mainConfig, mainConfigPath, previewConfigPath, packageManager, configDir }) {
    let useSubPathImports = true;
    if (!process.env.IN_STORYBOOK_SANDBOX) {
      // prompt whether the user wants to use imports map
      logger.logBox(dedent`
        The CSF factories format benefits from subpath imports (the imports property in your \`package.json\`), which is a node standard for module resolution. This makes it more convenient to import the preview config in your story files.
      
        However, please note that this might not work if you have an outdated tsconfig, use custom paths, or have type alias plugins configured in your project. You can always rerun this codemod and select another option to update your code later.
      
        More info: ${picocolors.yellow('https://storybook.js.org/docs/api/csf/csf-factories#subpath-imports')}

        As we modify your story files, we can create two types of imports:
      
        - ${picocolors.bold('Subpath imports (recommended):')} ${picocolors.cyan("`import preview from '#.storybook/preview'`")}
        - ${picocolors.bold('Relative imports (suitable for mono repos):')} ${picocolors.cyan("`import preview from '../../.storybook/preview'`")}
      `);

      useSubPathImports = await prompt.select<boolean>({
        message: 'Which would you like to use?',
        options: [
          { label: 'Subpath imports', value: true },
          { label: 'Relative imports', value: false },
        ],
      });
    }

    const { packageJson } = packageManager.primaryPackageJson;

    if (useSubPathImports && !packageJson.imports?.['#*']) {
      logger.log(
        `🗺️ Adding imports map in ${picocolors.cyan(packageManager.primaryPackageJson.packageJsonPath)}`
      );
      packageJson.imports = {
        ...packageJson.imports,
        // @ts-expect-error we need to upgrade type-fest
        '#*': ['./*', './*.ts', './*.tsx', './*.js', './*.jsx'],
      };
      packageManager.writePackageJson(packageJson);
    }

    await runStoriesCodemod({
      dryRun,
      packageManager,
      useSubPathImports,
      previewConfigPath: previewConfigPath!,
    });

    logger.log('\n🛠️  Applying codemod on your main config...');
    const frameworkPackage =
      getFrameworkPackageName(mainConfig) || '@storybook/your-framework-here';
    await runCodemod(mainConfigPath, (fileInfo) =>
      configToCsfFactory(fileInfo, { configType: 'main', frameworkPackage }, { dryRun })
    );

    logger.log('\n🛠️  Applying codemod on your preview config...');
    await runCodemod(previewConfigPath, (fileInfo) =>
      configToCsfFactory(fileInfo, { configType: 'preview', frameworkPackage }, { dryRun })
    );

    await syncStorybookAddons(mainConfig, previewConfigPath!, configDir);

    logger.logBox(
      dedent`
          You can now run Storybook with the new CSF factories format.
          
          For more info, check out the docs:
          ${picocolors.yellow('https://storybook.js.org/docs/api/csf/csf-factories')}
        `
    );
  },
};
