import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { basename, dirname, extname, join, relative } from 'node:path';

import { types as t, traverse } from 'storybook/internal/babel';
import {
  extractFrameworkPackageName,
  findConfigFile,
  formatFileContent,
  getFrameworkName,
  getProjectRoot,
} from 'storybook/internal/common';
import type { CreateNewStoryRequestPayload } from 'storybook/internal/core-events';
import { isCsfFactoryPreview } from 'storybook/internal/csf-tools';
import { logger } from 'storybook/internal/node-logger';
import type { Options } from 'storybook/internal/types';

import * as walk from 'empathic/walk';

import type { ArgTypes } from '../../csf';
import { loadConfig, printConfig } from '../../csf-tools';
import {
  STORYBOOK_FN_PLACEHOLDER,
  generateDummyArgsFromArgTypes,
} from './get-dummy-args-from-argtypes';
import { getCsfFactoryTemplateForNewStoryFile } from './new-story-templates/csf-factory-template';
import { getJavaScriptTemplateForNewStoryFile } from './new-story-templates/javascript';
import { getTypeScriptTemplateForNewStoryFile } from './new-story-templates/typescript';

export async function getNewStoryFile(
  {
    componentFilePath,
    componentExportName,
    componentIsDefaultExport,
    componentExportCount,
  }: CreateNewStoryRequestPayload,
  options: Options
) {
  const frameworkPackageName = await getFrameworkName(options);
  const sanitizedFrameworkPackageName = extractFrameworkPackageName(frameworkPackageName);

  const base = basename(componentFilePath);
  const extension = extname(componentFilePath);
  const basenameWithoutExtension = base.replace(extension, '');
  const dir = dirname(componentFilePath);

  const { storyFileName, isTypescript, storyFileExtension } = getStoryMetadata(componentFilePath);
  const storyFileNameWithExtension = `${storyFileName}.${storyFileExtension}`;
  const alternativeStoryFileNameWithExtension = `${basenameWithoutExtension}.${componentExportName}.stories.${storyFileExtension}`;

  const exportedStoryName = 'Default';

  let useCsfFactory = false;
  let previewConfigPath: string | undefined;
  try {
    const previewConfig = findConfigFile('preview', options.configDir);
    if (previewConfig) {
      const previewContent = await readFile(previewConfig, 'utf-8');
      useCsfFactory = isCsfFactoryPreview(loadConfig(previewContent));
      previewConfigPath = previewConfig;
    }
  } catch {
    // TODO: improve this later on, for now while CSF factories are experimental, just fallback to CSF3
  }

  let args: Record<string, unknown> | undefined = undefined;

  try {
    const argTypes = (await options.presets.apply('internal_getArgTypesData', null, {
      ...options,
      componentFilePath,
      componentExportName,
    })) as ArgTypes | null;
    logger.debug(`Extracted argTypes for ${componentExportName}: ${JSON.stringify(argTypes)}`);

    if (argTypes) {
      const { required } = generateDummyArgsFromArgTypes(argTypes);
      if (Object.keys(required).length > 0) {
        args = required;
        logger.debug(
          `Generated dummy data using ArgTypes for ${componentExportName}: ${JSON.stringify(args)}`
        );
      }
    }
  } catch (error) {
    // If anything fails with the dummy data generation, just proceed without args
    logger.debug(`Could not generate dummy data for ${componentExportName}: ${error}`);
  }

  let storyFileContent = '';
  if (useCsfFactory) {
    // Calculate relative path from story file to preview config if needed
    // Only use relative path if package.json doesn't have an imports map
    let previewImportPath: string | undefined;
    if (previewConfigPath) {
      const hasImportsMap = await checkForImportsMap(options.configDir);
      if (!hasImportsMap) {
        const storyFilePath = join(getProjectRoot(), dir);
        const relPath = relative(storyFilePath, previewConfigPath);
        const pathWithoutExt = relPath.replace(/\.(ts|js|mts|cts|tsx|jsx)$/, '');
        previewImportPath = pathWithoutExt.startsWith('.') ? pathWithoutExt : `./${pathWithoutExt}`;
      }
    }

    storyFileContent = await getCsfFactoryTemplateForNewStoryFile({
      basenameWithoutExtension,
      componentExportName,
      componentIsDefaultExport,
      exportedStoryName,
      previewImportPath,
      args,
    });
  } else {
    storyFileContent =
      isTypescript && frameworkPackageName
        ? await getTypeScriptTemplateForNewStoryFile({
            basenameWithoutExtension,
            componentExportName,
            componentIsDefaultExport,
            frameworkPackage: sanitizedFrameworkPackageName,
            exportedStoryName,
            args,
          })
        : await getJavaScriptTemplateForNewStoryFile({
            basenameWithoutExtension,
            componentExportName,
            componentIsDefaultExport,
            exportedStoryName,
            args,
          });
  }

  storyFileContent = replaceArgsPlaceholders(storyFileContent);

  const storyFilePath =
    doesStoryFileExist(join(getProjectRoot(), dir), storyFileName) && componentExportCount > 1
      ? join(getProjectRoot(), dir, alternativeStoryFileNameWithExtension)
      : join(getProjectRoot(), dir, storyFileNameWithExtension);

  const formattedStoryFileContent = await formatFileContent(storyFilePath, storyFileContent);

  return {
    storyFilePath,
    exportedStoryName,
    storyFileContent: formattedStoryFileContent,
    dirname: dir,
  };
}

export const getStoryMetadata = (componentFilePath: string) => {
  const isTypescript = /\.(ts|tsx|mts|cts)$/.test(componentFilePath);
  const base = basename(componentFilePath);
  const extension = extname(componentFilePath);
  const basenameWithoutExtension = base.replace(extension, '');
  const storyFileExtension = isTypescript ? 'tsx' : 'jsx';
  return {
    storyFileName: `${basenameWithoutExtension}.stories`,
    storyFileExtension,
    isTypescript,
  };
};

export const doesStoryFileExist = (parentFolder: string, storyFileName: string) => {
  return (
    existsSync(join(parentFolder, `${storyFileName}.ts`)) ||
    existsSync(join(parentFolder, `${storyFileName}.tsx`)) ||
    existsSync(join(parentFolder, `${storyFileName}.js`)) ||
    existsSync(join(parentFolder, `${storyFileName}.jsx`))
  );
};

async function checkForImportsMap(configDir: string): Promise<boolean> {
  try {
    // Walk up from configDir to project root, checking each directory for package.json with imports
    for (const directory of walk.up(configDir, { last: getProjectRoot() })) {
      const packageJsonPath = join(directory, 'package.json');
      if (existsSync(packageJsonPath)) {
        const packageJsonContent = await readFile(packageJsonPath, 'utf-8');
        const packageJson = JSON.parse(packageJsonContent);
        if (packageJson.imports) {
          return true;
        }
      }
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Replaces non-primitive args placeholders like `[[STORYBOOK_FN_PLACEHOLDER]]` where it needs more
 * involved changes like adding imports, etc.
 */
function replaceArgsPlaceholders(storyFileContent: string) {
  // Avoid parsing unless we actually have placeholders to replace.
  if (!storyFileContent.includes(STORYBOOK_FN_PLACEHOLDER)) {
    return storyFileContent;
  }

  const storyFile = loadConfig(storyFileContent).parse();

  let needsFnImport = false;

  traverse(storyFile._ast, {
    StringLiteral(path) {
      if (path.node.value === STORYBOOK_FN_PLACEHOLDER) {
        needsFnImport = true;
        path.replaceWith(t.callExpression(t.identifier('fn'), []));
      }
    },
  });

  if (needsFnImport) {
    storyFile.setImport(['fn'], 'storybook/test');
  }

  return printConfig(storyFile).code;
}
