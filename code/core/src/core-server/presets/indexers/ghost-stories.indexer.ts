import { relative } from 'node:path';

import {
  extractProperRendererNameFromFramework,
  getFrameworkName,
  getProjectRoot,
} from 'storybook/internal/common';
import type {
  Indexer,
  IndexerOptions,
  Options,
  StoryIndexInput,
  SupportedRenderers,
} from 'storybook/internal/types';

import { createIndexEntries, getComponentFileInfos } from '../../utils/component-file-indexer';

interface GhostStoriesOptions extends Options {
  enabled?: boolean;
  titlePrefix?: string;
}

/** Default configuration for Ghost Stories */
const DEFAULT_OPTIONS: Partial<GhostStoriesOptions> = {
  enabled: true,
  titlePrefix: 'V:',
};

/** Ghost Stories Indexer Creates virtual stories for existing component files */
export class GhostStoriesIndexer implements Indexer {
  test: RegExp;
  private options: GhostStoriesOptions;

  constructor(options: GhostStoriesOptions) {
    this.options = { ...DEFAULT_OPTIONS, ...options };

    // Match component files but exclude story files
    this.test = /^(?!.*\.stories\.).*\.(tsx|jsx|ts|js)$/;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async createIndex(fileName: string, _options: IndexerOptions): Promise<StoryIndexInput[]> {
    if (!this.options.enabled) {
      return [];
    }

    // Skip if this is a story file
    if (fileName.includes('.stories.')) {
      return [];
    }

    try {
      // Get the renderer name for the parser
      const frameworkName = await getFrameworkName(this.options);
      const rendererName = (await extractProperRendererNameFromFramework(
        frameworkName
      )) as SupportedRenderers;
      // Find all suitable file infos for the current file
      const relativeFileName = relative(getProjectRoot(), fileName);
      const fileInfos = await getComponentFileInfos([relativeFileName], rendererName);
      const indexEntries = createIndexEntries(fileInfos);

      const entries: StoryIndexInput[] = indexEntries
        .map((indexEntry) =>
          this.createGhostStoryEntry(fileName, indexEntry.componentName, this.options)
        )
        .filter(Boolean) as StoryIndexInput[];

      return entries;
    } catch (error) {
      // Only warn for actual errors, not for files that don't exist
      if ((error as Error).message !== 'File not found') {
        console.warn(`Error indexing file ${fileName}:`, error);
      }
      return [];
    }
  }

  private createGhostStoryEntry(
    fileName: string,
    componentName: string,
    options: Options
  ): StoryIndexInput | null {
    try {
      const relativePath = relative(options.configDir || process.cwd(), fileName);

      // Create a virtual import path for the ghost story
      const virtualImportPath = `virtual:virtual-stories--${relativePath}--${componentName}`;

      return {
        /** The file to import from e.g. the story file. */
        importPath: virtualImportPath,
        /** The name of the export to import. */
        exportName: componentName,
        /** Tags for filtering entries in Storybook and its tools. */
        tags: ['virtual'],
        type: 'story',
        subtype: 'story',
        title: `Virtual ${relativePath}--${componentName}`,
      };
    } catch (error) {
      console.warn(`Error creating ghost story entry for ${componentName}:`, error);
      return null;
    }
  }
}

/** Factory function to create a Ghost Stories indexer */
export function createGhostStoriesIndexer(config: GhostStoriesOptions): Indexer {
  return new GhostStoriesIndexer(config);
}
