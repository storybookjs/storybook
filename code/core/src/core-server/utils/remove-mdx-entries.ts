import { isAbsolute, join, relative } from 'node:path';

import { commonGlobOptions, normalizeStories } from '@storybook/core/common';
import type { Options, StoriesEntry } from '@storybook/core/types';

import { glob } from 'glob';
import slash from 'slash';

export async function removeMDXEntries(
  entries: StoriesEntry[],
  options: Pick<Options, 'configDir'>
): Promise<StoriesEntry[]> {
  const list = normalizeStories(entries, {
    configDir: options.configDir,
    workingDir: options.configDir,
    defaultFilesPattern: '**/*.@(stories.@(js|jsx|mjs|ts|tsx))',
  });
  const result = (
    await Promise.all(
      list.map(async ({ directory, files, titlePrefix }) => {
        const pattern = join(directory, files);
        const absolutePattern = isAbsolute(pattern) ? pattern : join(options.configDir, pattern);
        const absoluteDirectory = isAbsolute(directory)
          ? directory
          : join(options.configDir, directory);

        return {
          files: (
            await glob(slash(absolutePattern), {
              ...commonGlobOptions(absolutePattern),
              follow: true,
            })
          ).map((f) => relative(absoluteDirectory, f)),
          directory,
          titlePrefix,
        };
      })
    )
  ).flatMap<StoriesEntry>(({ directory, files, titlePrefix }, i) => {
    const filteredEntries = files.filter((s) => !s.endsWith('.mdx'));
    // only return the filtered entries when there is something to filter
    // as webpack is faster with unexpanded globs
    let items = [];
    if (filteredEntries.length < files.length) {
      items = filteredEntries.map((k) => ({
        directory,
        titlePrefix,
        files: `**/${k}`,
      }));
    } else {
      items = [
        { directory: list[i].directory, titlePrefix: list[i].titlePrefix, files: list[i].files },
      ];
    }

    return items;
  });
  return result;
}
