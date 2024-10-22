import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { ComponentTitle, PresetProperty, StoryName, Tag } from 'storybook/internal/types';

import yaml from 'yaml';

type FileContent = {
  title: ComponentTitle;
  tags?: Tag[];
  stories: { name: StoryName; tags?: Tag[] }[];
};

// eslint-disable-next-line @typescript-eslint/naming-convention
export const experimental_indexers: PresetProperty<'experimental_indexers'> = (
  existingIndexers
) => [
  {
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
  },
  ...(existingIndexers || []),
];

export const previewAnnotations: PresetProperty<'previewAnnotations'> = async (
  input = [],
  options
) => {
  const { presetsList } = options;
  if (!presetsList) {
    return input;
  }
  const result: string[] = [];

  return result.concat(input).concat([join(__dirname, 'entry-preview.js')]);
};
