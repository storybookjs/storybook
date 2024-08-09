import yaml from 'yaml';
import type { Tag, StoryName, ComponentTitle, PresetProperty } from 'storybook/internal/types';

import { join } from 'path';
import { readJson } from '@ndelangen/fs-extra-unified';
import { readFile } from 'node:fs/promises';

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
      const content: FileContent = fileName.endsWith('.json')
        ? await readJson(fileName, 'utf-8')
        : yaml.parse((await readFile(fileName, 'utf-8')).toString());

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

  return result.concat(input).concat([join(__dirname, 'entry-preview.mjs')]);
};
