import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { basename, dirname, extname, join, relative } from 'node:path';

import {
  extractFrameworkPackageName,
  findConfigFile,
  getFrameworkName,
  getProjectRoot,
} from 'storybook/internal/common';
import type { CreateNewStoryRequestPayload } from 'storybook/internal/core-events';
import { isCsfFactoryPreview } from 'storybook/internal/csf-tools';
import { logger } from 'storybook/internal/node-logger';
import type { Options } from 'storybook/internal/types';

import * as walk from 'empathic/walk';

import { loadConfig } from '../../csf-tools';
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

  let args: Record<string, unknown> | undefined;

  try {
    // Try to generate mocked args for the component
    try {
      // Try to dynamically import the generateMockProps function from the react renderer
      const { getMockedProps } = await import(
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore - Dynamic import from source for development
        '@storybook/react/componentManifest'
      );

      // Get component docgen data
      const { required } = getMockedProps(componentFilePath, componentExportName) ?? {};
      args = required;
      logger.debug(`Generated mocked props for ${componentExportName}: ${JSON.stringify(args)}`);
    } catch (error) {
      // If anything fails with the mock generation, just proceed without args
      logger.debug(`Could not generate mocked props for ${componentExportName}: ${error}`);
    }
  } catch (error) {
    // If anything fails with the mock generation, just proceed without args
    logger.debug(`Could not generate mocked props for ${componentExportName}: ${error}`);
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

  // Add fn import and replace __function__ with fn() if needed
  if (storyFileContent.includes('"__function__"')) {
    // Add the fn import
    const fnImport = "import { fn } from 'storybook/test';\n";
    const lines = storyFileContent.split('\n');
    let insertIndex = 0;

    // Find the first import statement or the first non-empty line
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('import') || (line !== '' && !line.startsWith('//'))) {
        insertIndex = i;
        break;
      }
    }

    lines.splice(insertIndex, 0, fnImport.trim());
    storyFileContent = lines.join('\n');

    // Replace "__function__" with fn()
    storyFileContent = storyFileContent.replace(/"__function__"/g, 'fn()');

    // Replace "__react_node__" with <div>Hello world</div>
    storyFileContent = storyFileContent.replace(/"__react_node__"/g, '<div>Hello world</div>');
  }

  const storyFilePath =
    doesStoryFileExist(join(getProjectRoot(), dir), storyFileName) && componentExportCount > 1
      ? join(getProjectRoot(), dir, alternativeStoryFileNameWithExtension)
      : join(getProjectRoot(), dir, storyFileNameWithExtension);

  return { storyFilePath, exportedStoryName, storyFileContent, dirname };
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
