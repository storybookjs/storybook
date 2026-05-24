import {
  type JsPackageManager,
  optionalEnvToBoolean,
  syncStorybookAddons,
} from 'storybook/internal/common';
import { logger, prompt } from 'storybook/internal/node-logger';

import path from 'path';
import picocolors from 'picocolors';
import { dedent } from 'ts-dedent';

import { runCodemod } from '../automigrate/codemod.ts';
import { getFrameworkPackageName } from '../automigrate/helpers/mainConfigFile.ts';
import type { CommandFix } from '../automigrate/types.ts';
import { configToCsfFactory } from './helpers/config-to-csf-factory.ts';
import { storyToCsfFactory } from './helpers/story-to-csf-factory.ts';

async function runStoriesCodemod(options: {
  dryRun: boolean | undefined;
  packageManager: JsPackageManager;
  useSubPathImports: boolean;
  previewConfigPath: string;
  configDir: string;
  yes: boolean | undefined;
  glob: string | undefined;
}) {
  const { dryRun, packageManager, yes, glob, ...codemodOptions } = options;
  try {
    const inSandbox = optionalEnvToBoolean(process.env.IN_STORYBOOK_SANDBOX) ?? false;
    let globString = glob ?? '**/*.{stories,story}.{js,jsx,ts,tsx,mjs,mjsx,mts,mtsx}';

    if (!glob && inSandbox) {
      // Sandbox uses limited glob for faster testing (unless glob explicitly provided)
      globString = '{stories,src}/**/{Button,Header,Page,button,header,page}.stories.*';
    } else if (!glob && !yes) {
      logger.log('Please enter the glob for your stories to migrate');
      globString = await prompt.text({
        message: 'glob',
        initialValue: globString,
      });
    }

    logger.step('Applying codemod on your stories, this might take some time...');

    await packageManager.runPackageCommand({
      args: ['storybook', 'migrate', 'csf-2-to-3', `--glob="${globString}"`],
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

const LEGACY_SUBPATH_IMPORT = ['./*', './*.ts', './*.tsx', './*.js', './*.jsx'];

const toPosixPath = (filePath: string) => filePath.replace(/\\/g, '/');

const resolveFromOperationDir = (filePath: string, operationDir: string) =>
  path.isAbsolute(filePath) ? filePath : path.resolve(operationDir, filePath);

export const getStorybookSubpathImportTarget = (configDir: string, packageJsonDir: string) => {
  const absoluteConfigDir = resolveFromOperationDir(configDir, packageJsonDir);
  const configDirFromPackageJson = toPosixPath(path.relative(packageJsonDir, absoluteConfigDir));

  if (!configDirFromPackageJson) {
    return './*';
  }

  return `./${configDirFromPackageJson.replace(/^\.\//, '')}/*`;
};

const isLegacySubpathImport = (value: unknown) =>
  Array.isArray(value) &&
  value.length === LEGACY_SUBPATH_IMPORT.length &&
  value.every((entry, index) => entry === LEGACY_SUBPATH_IMPORT[index]);

export const getUpdatedStorybookImportsMap = (
  imports: Record<string, unknown> | undefined,
  storybookImportTarget: string
) => {
  const updatedImports = { ...imports };
  let shouldWritePackageJson = false;

  if (updatedImports['#storybook/*'] !== storybookImportTarget) {
    updatedImports['#storybook/*'] = storybookImportTarget;
    shouldWritePackageJson = true;
  }

  if (isLegacySubpathImport(updatedImports['#*'])) {
    delete updatedImports['#*'];
    shouldWritePackageJson = true;
  }

  return { imports: updatedImports, shouldWritePackageJson };
};

export const csfFactories: CommandFix = {
  id: 'csf-factories',
  promptType: 'command',
  async run({
    dryRun,
    mainConfig,
    mainConfigPath,
    previewConfigPath,
    packageManager,
    configDir,
    yes,
    glob,
  }) {
    const inSandbox = optionalEnvToBoolean(process.env.IN_STORYBOOK_SANDBOX) ?? false;
    // Defaults to false for users and true in sandbox
    let useSubPathImports = inSandbox;

    if (!yes && !inSandbox) {
      // prompt whether the user wants to use imports map
      logger.logBox(dedent`
        The CSF Factories format can benefit from using absolute imports of your ${picocolors.cyan(previewConfigPath)} file. We can configure that for you, using subpath imports (a node standard), by adjusting the imports property of your package.json.
        
        However, we cannot broadly recommend it for all projects, because it might not work in some monorepo setups or if you have an outdated tsconfig, use custom paths, or have type alias plugins configured in your project. You can always rerun this codemod and select another option to update your code later.
        
        More info: ${picocolors.yellow('https://storybook.js.org/docs/api/csf/csf-next?ref=upgrade#previewmeta')}
      `);

      useSubPathImports = await prompt.select<boolean>({
        message: 'Which import type would you like to use for your story files?',
        options: [
          {
            label: "Relative imports (import preview from '../../.storybook/preview')",
            value: false,
          },
          { label: "Subpath imports (import preview from '#storybook/preview.ts')", value: true },
        ],
      });
    }

    const { packageJson } = packageManager.primaryPackageJson;
    const resolvedConfigDir = resolveFromOperationDir(
      configDir,
      packageManager.primaryPackageJson.operationDir
    );
    const resolvedPreviewConfigPath = resolveFromOperationDir(
      previewConfigPath!,
      packageManager.primaryPackageJson.operationDir
    );

    if (useSubPathImports) {
      const storybookImportTarget = getStorybookSubpathImportTarget(
        resolvedConfigDir,
        packageManager.primaryPackageJson.operationDir
      );
      const { imports, shouldWritePackageJson } = getUpdatedStorybookImportsMap(
        packageJson.imports,
        storybookImportTarget
      );

      if (shouldWritePackageJson) {
        logger.step(
          `Adding imports map in ${picocolors.cyan(packageManager.primaryPackageJson.packageJsonPath)}`
        );
        packageJson.imports = imports;
        packageManager.writePackageJson(
          packageJson,
          packageManager.primaryPackageJson.operationDir
        );
      }
    }

    await runStoriesCodemod({
      dryRun,
      packageManager,
      useSubPathImports,
      previewConfigPath: resolvedPreviewConfigPath,
      configDir: resolvedConfigDir,
      yes,
      glob,
    });

    logger.step('Applying codemod on your main config...');
    const frameworkPackage =
      getFrameworkPackageName(mainConfig) || '@storybook/your-framework-here';
    await runCodemod(mainConfigPath, (fileInfo) =>
      configToCsfFactory(fileInfo, { configType: 'main', frameworkPackage }, { dryRun })
    );

    logger.step('Applying codemod on your preview config...');
    await runCodemod(previewConfigPath, (fileInfo) =>
      configToCsfFactory(fileInfo, { configType: 'preview', frameworkPackage }, { dryRun })
    );

    await syncStorybookAddons(mainConfig, previewConfigPath!, configDir);

    logger.logBox(
      dedent`
          You can now run Storybook with the new CSF factories format.
          
          For more info, check out the docs:
          ${picocolors.yellow('https://storybook.js.org/docs/api/csf/csf-next?ref=upgrade')}
        `
    );
  },
};
