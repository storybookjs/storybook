import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { getProjectRoot } from 'storybook/internal/common';
import type { SupportedRenderers } from 'storybook/internal/types';

import { doesStoryFileExist, getStoryMetadata } from './get-new-story-file';
import { getParser } from './parser';
import { searchFiles } from './search-files';

export interface ComponentFileInfo {
  filepath: string;
  exportedComponents: Array<{
    name: string;
    default: boolean;
  }> | null;
  storyFileExists: boolean;
}

export interface ComponentIndexEntry {
  filepath: string;
  componentName: string;
  isDefaultExport: boolean;
  storyFileExists: boolean;
}

/** Search for component files and create index entries for each file and export */
export async function createComponentIndex({
  searchQuery,
  rendererName,
}: {
  searchQuery: string;
  rendererName: SupportedRenderers;
}): Promise<ComponentIndexEntry[]> {
  const files = await findComponentFiles(searchQuery);
  const fileInfos = await getComponentFileInfos(files, rendererName);

  return createIndexEntries(fileInfos);
}

/** Find component files that match the search query */
export async function findComponentFiles(searchQuery: string): Promise<string[]> {
  return searchFiles({
    searchQuery,
    cwd: getProjectRoot(),
  });
}

/** Get component file information including exports and story file existence */
export async function getComponentFileInfos(
  files: string[],
  rendererName: SupportedRenderers
): Promise<ComponentFileInfo[]> {
  const parser = getParser(rendererName);

  const fileInfos = await Promise.all(
    files.map(async (file) => {
      try {
        const content = await readFile(join(getProjectRoot(), file), 'utf-8');
        const { storyFileName } = getStoryMetadata(join(getProjectRoot(), file));
        const dir = dirname(file);

        const storyFileExists = doesStoryFileExist(join(getProjectRoot(), dir), storyFileName);
        const info = await parser.parse(content);

        return {
          filepath: file,
          exportedComponents: info.exports,
          storyFileExists,
        };
      } catch (e) {
        return {
          filepath: file,
          exportedComponents: null,
          storyFileExists: false,
        };
      }
    })
  );

  return fileInfos;
}

/** Create index entries for each file and each export, excluding files that already have stories */
export function createIndexEntries(fileInfos: ComponentFileInfo[]): ComponentIndexEntry[] {
  const entries: ComponentIndexEntry[] = [];

  for (const fileInfo of fileInfos) {
    // Skip files that already have story files
    if (fileInfo.storyFileExists) {
      continue;
    }

    // Skip files that couldn't be parsed or have no exports
    if (!fileInfo.exportedComponents || fileInfo.exportedComponents.length === 0) {
      continue;
    }

    // Create an entry for each exported component
    for (const component of fileInfo.exportedComponents) {
      entries.push({
        filepath: fileInfo.filepath,
        componentName: component.name,
        isDefaultExport: component.default,
        storyFileExists: fileInfo.storyFileExists,
      });
    }
  }

  return entries;
}

/** Filter out files that already have story files */
export function filterFilesWithoutStories(fileInfos: ComponentFileInfo[]): ComponentFileInfo[] {
  return fileInfos.filter((fileInfo) => !fileInfo.storyFileExists);
}
