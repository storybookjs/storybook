import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { basename, dirname, extname, join } from 'node:path';

import {
  extractProperRendererNameFromFramework,
  findConfigFile,
  getFrameworkName,
  getProjectRoot,
  rendererPackages,
} from 'storybook/internal/common';
import type { CreateNewStoryRequestPayload } from 'storybook/internal/core-events';
import { isCsfFactoryPreview } from 'storybook/internal/csf-tools';
import type { Indexer, Options } from 'storybook/internal/types';

import { loadConfig } from '../../csf-tools';
import { getCsfFactoryTemplateForNewStoryFile } from './new-story-templates/csf-factory-template';
import { getJavaScriptTemplateForNewStoryFile } from './new-story-templates/javascript';
import { getTypeScriptTemplateForNewStoryFile } from './new-story-templates/typescript';

export const csfCreateNewStoryFile: NonNullable<Indexer['createNewStoryFile']>['create'] = async (
  {
    componentFilePath,
    componentExportName,
    componentIsDefaultExport,
    componentExportCount,
    newStoryName,
  },
  options
) => {
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

  let useCsfFactory = false;
  try {
    const previewConfig = findConfigFile('preview', options.configDir);
    if (previewConfig) {
      const previewContent = await readFile(previewConfig, 'utf-8');
      useCsfFactory = isCsfFactoryPreview(loadConfig(previewContent));
    }
  } catch (err) {
    // TODO: improve this later on, for now while CSF factories are experimental, just fallback to CSF3
  }

  let code = '';
  if (useCsfFactory) {
    code = await getCsfFactoryTemplateForNewStoryFile({
      basenameWithoutExtension,
      componentExportName,
      componentIsDefaultExport,
      exportedStoryName: newStoryName,
    });
  } else {
    code =
      isTypescript && rendererPackage
        ? await getTypeScriptTemplateForNewStoryFile({
            basenameWithoutExtension,
            componentExportName,
            componentIsDefaultExport,
            rendererPackage,
            exportedStoryName: newStoryName,
          })
        : await getJavaScriptTemplateForNewStoryFile({
            basenameWithoutExtension,
            componentExportName,
            componentIsDefaultExport,
            exportedStoryName: newStoryName,
          });
  }

  const newStoryFilePath =
    doesStoryFileExist(join(cwd, dir), storyFileName) && componentExportCount > 1
      ? join(cwd, dir, alternativeStoryFileNameWithExtension)
      : join(cwd, dir, storyFileNameWithExtension);

  return {
    newStoryFilePath,
    code,
  };
};

export const getStoryMetadata = (
  componentFilePath: string
): {
  storyFileName: string;
  storyFileExtension: string;
  isTypescript: boolean;
  isSvelte: boolean;
} => {
  const isSvelte = /\.svelte$/.test(componentFilePath);
  const isTypescript = /\.(ts|tsx|mts|cts)$/.test(componentFilePath);
  const base = basename(componentFilePath);
  const extension = extname(componentFilePath);
  const basenameWithoutExtension = base.replace(extension, '');
  const storyFileExtension = isSvelte ? 'svelte' : isTypescript ? 'tsx' : 'jsx';
  return {
    storyFileName: `${basenameWithoutExtension}.stories`,
    storyFileExtension,
    isTypescript,
    isSvelte,
  };
};

export const doesStoryFileExist = (parentFolder: string, storyFileName: string) => {
  return (
    existsSync(join(parentFolder, `${storyFileName}.ts`)) ||
    existsSync(join(parentFolder, `${storyFileName}.tsx`)) ||
    existsSync(join(parentFolder, `${storyFileName}.js`)) ||
    existsSync(join(parentFolder, `${storyFileName}.jsx`)) ||
    existsSync(join(parentFolder, `${storyFileName}.svelte`))
  );
};
