import { existsSync } from 'node:fs';
import { basename, dirname, extname, join } from 'node:path';

import {
  extractProperRendererNameFromFramework,
  getFrameworkName,
  getProjectRoot,
  rendererPackages,
} from '@storybook/core/common';
import type { Options } from '@storybook/core/types';

import type { CreateNewStoryRequestPayload } from '@storybook/core/core-events';

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
  const cwd = getProjectRoot();

  const frameworkPackageName = await getFrameworkName(options);
  const rendererName = await extractProperRendererNameFromFramework(frameworkPackageName);
  const rendererPackage = Object.entries(rendererPackages).find(
    ([, value]) => value === rendererName
  )?.[0];

  const base = basename(componentFilePath);
  const extension = extname(componentFilePath);
  const basenameWithoutExtension = base.replace(extension, '');
  const dir = dirname(componentFilePath);

  const { storyFileName, isTypescript, storyFileExtension } = getStoryMetadata(componentFilePath);
  const storyFileNameWithExtension = `${storyFileName}.${storyFileExtension}`;
  const alternativeStoryFileNameWithExtension = `${basenameWithoutExtension}.${componentExportName}.stories.${storyFileExtension}`;

  const exportedStoryName = 'Default';

  const storyFileContent =
    isTypescript && rendererPackage
      ? await getTypeScriptTemplateForNewStoryFile({
          basenameWithoutExtension,
          componentExportName,
          componentIsDefaultExport,
          rendererPackage,
          exportedStoryName,
        })
      : await getJavaScriptTemplateForNewStoryFile({
          basenameWithoutExtension,
          componentExportName,
          componentIsDefaultExport,
          exportedStoryName,
        });

  const storyFilePath =
    doesStoryFileExist(join(cwd, dir), storyFileName) && componentExportCount > 1
      ? join(cwd, dir, alternativeStoryFileNameWithExtension)
      : join(cwd, dir, storyFileNameWithExtension);

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
