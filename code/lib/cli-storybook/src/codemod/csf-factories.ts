import { existsSync } from 'node:fs';
import { join } from 'node:path';

import {
  getProjectRelativePath,
  optionalEnvToBoolean,
  syncPreviewAddonsWithMainConfig,
} from 'storybook/internal/common';
import { formatConfig, loadConfig } from 'storybook/internal/csf-tools';
import { CLI_COLORS, logger, prompt } from 'storybook/internal/node-logger';

import { normalize } from 'pathe';
import picocolors from 'picocolors';
import { dedent } from 'ts-dedent';

import {
  applyPreviewImportsMap,
  hasSiblingReactNativeConfig,
  isReactNativeStorybookPath,
  previewFileForImports,
  previewImportTarget,
} from '../../../../core/src/shared/constants/config-folder.ts';
import { type FileInfo, runCodemod } from '../automigrate/codemod.ts';
import { editParsedFile } from '../automigrate/helpers/edit-parsed-file.ts';
import { getFrameworkPackageName } from '../automigrate/helpers/mainConfigFile.ts';
import type { CommandFix } from '../automigrate/types.ts';
import { configToCsfFactory } from './helpers/config-to-csf-factory.ts';
import { storyToCsfFactory } from './helpers/story-to-csf-factory.ts';
import { svelteCsfToCsfFactory } from './helpers/svelte-csf-to-csf-factory.ts';
import csf2To3 from './transforms/csf-2-to-3.ts';

export async function storyToCsf4(
  info: FileInfo,
  options: Parameters<typeof storyToCsfFactory>[1]
) {
  if (info.path.endsWith('.svelte')) {
    return svelteCsfToCsfFactory(info, options);
  }
  // A story csf-2-to-3 refuses, such as one with a namespace import, can already be CSF 3.
  const source = await csf2To3(info, { keepStoryTypes: true }).catch((error) => {
    logger.debug(`csf-2-to-3 skipped ${info.path}: ${String(error)}`);
    return info.source;
  });
  const output = await storyToCsfFactory({ ...info, source }, options);
  // The factory returns its input when it skips a file. Don't write that half-migrated input.
  return output === source ? info.source : output;
}

// Not recursive: sandboxes symlink the monorepo template stories into these folders.
export const SANDBOX_STORIES_GLOB =
  '{stories,src/stories}/{Button,Header,Page,button,header,page}.stories.*';

async function runStoriesCodemod(options: {
  dryRun: boolean | undefined;
  useSubPathImports: boolean;
  previewConfigPath: string;
  yes: boolean | undefined;
  glob: string | undefined;
}) {
  const { dryRun, yes, glob, ...codemodOptions } = options;
  const inSandbox = optionalEnvToBoolean(process.env.IN_STORYBOOK_SANDBOX) ?? false;
  const promptsForGlob = !glob && !inSandbox && !yes;
  try {
    let globString = glob ?? '**/*.{stories,story}.{js,jsx,ts,tsx,mjs,mjsx,mts,mtsx,svelte}';

    if (!glob && inSandbox) {
      globString = SANDBOX_STORIES_GLOB;
    } else if (promptsForGlob) {
      logger.log('Please enter the glob for your stories to migrate');
      globString = await prompt.text({
        message: 'glob',
        initialValue: globString,
      });
    }

    logger.step(
      dryRun
        ? 'Checking how codemods would apply on your stories'
        : 'Applying codemod on your stories, this might take some time...'
    );

    await runCodemod(globString, (info) => storyToCsf4(info, codemodOptions), {
      dryRun,
      announceDryRun: false,
    });
  } catch (err: any) {
    // Ask for another glob. Without a prompt, the same glob would match nothing again.
    if (err.message === 'No files matched' && promptsForGlob) {
      await runStoriesCodemod(options);
    } else {
      throw err;
    }
  }
}

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
    const isReactNativePreview =
      isReactNativeStorybookPath(previewConfigPath) ||
      isReactNativeStorybookPath(configDir) ||
      hasSiblingReactNativeConfig(configDir, existsSync);
    // React Native always uses the documented specifier so Metro can alias it.
    let useSubPathImports = inSandbox || isReactNativePreview;

    if (!yes && !inSandbox && !isReactNativePreview) {
      // prompt whether the user wants to use imports map
      logger.logBox(dedent`
        The CSF 4 format can benefit from using absolute imports of your ${picocolors.cyan(previewConfigPath && normalize(previewConfigPath))} file. We can configure that for you, using subpath imports (a node standard), by adjusting the imports property of your package.json.
        
        However, we cannot broadly recommend it for all projects, because it might not work in some monorepo setups or if you have an outdated tsconfig, use custom paths, or have type alias plugins configured in your project. You can always rerun this codemod and select another option to update your code later.
        
        More info: ${picocolors.yellow('https://storybook.js.org/docs/writing-stories/csf/?ref=upgrade#subpath-imports')}
      `);

      useSubPathImports = await prompt.select<boolean>({
        message: 'Which import type would you like to use for your story files?',
        options: [
          {
            label: "Relative imports (import preview from '../../.storybook/preview')",
            value: false,
          },
          { label: "Subpath imports (import preview from '#.storybook/preview')", value: true },
        ],
      });
    }

    const { packageJson, operationDir, packageJsonPath } = packageManager.primaryPackageJson;
    const writeImportsMap = () => {
      if (dryRun) {
        logger.step(
          `Would add an imports map in ${CLI_COLORS.change(getProjectRelativePath(packageJsonPath))}`
        );
        return;
      }
      logger.step(
        `Adding imports map in ${picocolors.cyan(getProjectRelativePath(packageJsonPath))}`
      );
      packageManager.writePackageJson(packageJson, operationDir);
    };

    if (isReactNativePreview) {
      const nativePreviewFile = previewConfigPath ?? join(configDir, 'preview.tsx');
      const previewFile = previewFileForImports(nativePreviewFile, existsSync);
      if (previewImportTarget(previewFile, operationDir) == null) {
        useSubPathImports = false;
      } else if (applyPreviewImportsMap(packageJson, previewFile, operationDir)) {
        writeImportsMap();
      }
    } else if (useSubPathImports && !packageJson.imports?.['#*']) {
      packageJson.imports = {
        ...packageJson.imports,
        '#*': ['./*', './*.ts', './*.tsx', './*.js', './*.jsx'],
      };
      writeImportsMap();
    }

    await runStoriesCodemod({
      dryRun,
      useSubPathImports,
      previewConfigPath: previewConfigPath!,
      yes,
      glob,
    });

    const frameworkPackage =
      getFrameworkPackageName(mainConfig) || '@storybook/your-framework-here';
    const runConfigCodemod = (path: string, transform: (info: FileInfo) => Promise<string>) =>
      runCodemod([path], transform, { dryRun, announceDryRun: false });

    logger.step(
      dryRun
        ? 'Checking how codemods would apply on your main config'
        : 'Applying codemod on your main config...'
    );
    await runConfigCodemod(mainConfigPath!, (info) =>
      configToCsfFactory(info, { configType: 'main', frameworkPackage }, { skipFormatting: true })
    );

    logger.step(
      dryRun
        ? 'Checking how codemods would apply on your preview config'
        : 'Applying codemod on your preview config...'
    );
    // The addons of the main config are synced into the converted preview within the same
    // transform, so a dry run reports them too.
    await runConfigCodemod(previewConfigPath!, async (info) => {
      const preview = loadConfig(
        await configToCsfFactory(
          info,
          { configType: 'preview', frameworkPackage },
          { skipFormatting: true }
        ),
        info.path
      ).parse();
      await editParsedFile(preview, (config) =>
        syncPreviewAddonsWithMainConfig(mainConfig, config, configDir, { dryRun })
      );
      return formatConfig(preview);
    });

    if (dryRun) {
      logger.step(CLI_COLORS.success('Dry run finished: no files were changed.'));
      return;
    }

    logger.logBox(
      dedent`
          You can now run Storybook with the new CSF 4 format.
          
          For more info, check out the docs:
          ${picocolors.yellow('https://storybook.js.org/docs/writing-stories/csf/upgrade?ref=upgrade')}
        `
    );
  },
};
