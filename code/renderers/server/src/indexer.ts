import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import type { ComponentTitle, Indexer, StoryName, Tag } from '@storybook/core/internal/types';

import yaml from 'yaml';

type FileContent = {
  title: ComponentTitle;
  tags?: Tag[];
  stories: { name: StoryName; tags?: Tag[] }[];
};

/** Index `*.stories.json` and `*.stories.yaml` files. */
export const serverIndexer: Indexer = {
  test: /(stories|story)\.(json|ya?ml)$/,
  createIndex: async (fileName) => {
    const rawFile = await readFile(fileName, { encoding: 'utf8' });
    const content: FileContent = fileName.endsWith('.json')
      ? JSON.parse(rawFile)
      : yaml.parse(rawFile);

    return content.stories.map((story) => {
      const tags = Array.from(new Set([...(content.tags ?? []), ...(story.tags ?? [])]));
      return {
        importPath: fileName,
        exportName: story.name,
        name: story.name,
        title: content.title,
        tags,
        type: 'story',
      };
    });
  },
};

/** Resolve the renderer's preview entry. */
export function getEntryPreview(): string {
  return fileURLToPath(import.meta.resolve('@storybook/server/entry-preview'));
}
