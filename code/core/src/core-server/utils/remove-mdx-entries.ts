import { join, relative, resolve } from 'node:path';

import {
  commonGlobOptions,
  globCaseSensitiveMatch,
  normalizeStories,
} from 'storybook/internal/common';
import type { Options, StoriesEntry } from 'storybook/internal/types';

import { glob } from 'tinyglobby';

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
        const absoluteDirectory = resolve(options.configDir, directory);

        return {
          files: (
            await glob(files, {
              ...commonGlobOptions(join(absoluteDirectory, files)),
              cwd: absoluteDirectory,
              absolute: true,
              caseSensitiveMatch: globCaseSensitiveMatch,
              expandDirectories: false,
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
