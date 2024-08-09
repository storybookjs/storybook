import { getStorybookVersionSpecifier } from 'storybook/internal/cli';
import {
  JsPackageManagerFactory,
  getCoercedStorybookVersion,
  getStorybookInfo,
} from 'storybook/internal/common';

import { listCodemods, runCodemod } from '@storybook/codemod';

import { runFixes } from './automigrate';
import { mdxToCSF } from './automigrate/fixes/mdx-to-csf';

const logger = console;

type CLIOptions = {
  glob: string;
  configDir?: string;
  dryRun?: boolean;
  list?: string[];
  /**
   * Rename suffix of matching files after codemod has been applied, e.g. ".js:.ts"
   */
  rename?: string;
  /**
   * jscodeshift parser
   */
  parser?: 'babel' | 'babylon' | 'flow' | 'ts' | 'tsx';
};

export async function migrate(
  migration: any,
  { glob, dryRun, list, rename, parser, configDir: userSpecifiedConfigDir }: CLIOptions
) {
  if (list) {
    listCodemods().forEach((key: any) => logger.log(key));
  } else if (migration) {
    if (migration === 'mdx-to-csf' && !dryRun) {
      const packageManager = JsPackageManagerFactory.getPackageManager();

      const [packageJson, storybookVersion] = await Promise.all([
        packageManager.retrievePackageJson(),
        getCoercedStorybookVersion(packageManager),
      ]);
      const { configDir: inferredConfigDir, mainConfig: mainConfigPath } = getStorybookInfo(
        packageJson,
        userSpecifiedConfigDir
      );
      const configDir = userSpecifiedConfigDir || inferredConfigDir || '.storybook';

      // GUARDS
      if (!storybookVersion) {
        throw new Error('Could not determine Storybook version');
      }

      if (!mainConfigPath) {
        throw new Error('Could not determine main config path');
      }

      await runFixes({
        fixes: [mdxToCSF],
        configDir,
        mainConfigPath,
        packageManager,
        storybookVersion,
        beforeVersion: storybookVersion,
        isUpgrade: false,
      });
      await addStorybookBlocksPackage();
    }

    await runCodemod(migration, { glob, dryRun, logger, rename, parser });
  } else {
    throw new Error('Migrate: please specify a migration name or --list');
  }
}

export async function addStorybookBlocksPackage() {
  const packageManager = JsPackageManagerFactory.getPackageManager();
  const packageJson = await packageManager.retrievePackageJson();
  const versionToInstall = getStorybookVersionSpecifier(await packageManager.retrievePackageJson());
  logger.info(`✅ Adding "@storybook/blocks" package`);
  await packageManager.addDependencies({ installAsDevDependencies: true, packageJson }, [
    `@storybook/blocks@${versionToInstall}`,
  ]);
}
