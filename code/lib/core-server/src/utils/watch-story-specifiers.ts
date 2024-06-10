import Watchpack from 'watchpack';
import slash from 'slash';
import fs from 'fs';
import path from 'path';
import uniq from 'lodash/uniq.js';

import type { NormalizedStoriesSpecifier, Path } from '@storybook/types';
import { commonGlobOptions } from '@storybook/core-common';

const isDirectory = (directory: Path) => {
  try {
    return fs.lstatSync(directory).isDirectory();
  } catch (err) {
    return false;
  }
};

// Watchpack (and path.relative) passes paths either with no leading './' - e.g. `src/Foo.stories.js`,
// or with a leading `../` (etc), e.g. `../src/Foo.stories.js`.
// We want to deal in importPaths relative to the working dir, so we normalize
function toImportPath(relativePath: Path) {
  return relativePath.startsWith('.') ? relativePath : `./${relativePath}`;
}

export function watchStorySpecifiers(
  specifiers: NormalizedStoriesSpecifier[],
  options: { workingDir: Path },
  onInvalidate: (specifier: NormalizedStoriesSpecifier, path: Path, removed: boolean) => void
) {
  // See https://www.npmjs.com/package/watchpack for full options.
  // If you want less traffic, consider using aggregation with some interval
  const wp = new Watchpack({
    // poll: true, // Slow!!! Enable only in special cases
    followSymlinks: false,
    ignored: ['**/.git', '**/node_modules'],
  });
  wp.watch({
    directories: uniq(specifiers.map((ns) => ns.directory)),
  });

  async function onChangeOrRemove(watchpackPath: Path, removed: boolean) {
    // Watchpack passes paths either with no leading './' - e.g. `src/Foo.stories.js`,
    // or with a leading `../` (etc), e.g. `../src/Foo.stories.js`.
    // We want to deal in importPaths relative to the working dir, or absolute paths.
    const importPath = slash(watchpackPath.startsWith('.') ? watchpackPath : `./${watchpackPath}`);

    const matchingSpecifier = specifiers.find((ns) => ns.importPathMatcher.exec(importPath));
    if (matchingSpecifier) {
      onInvalidate(matchingSpecifier, importPath, removed);
      return;
    }

    // When a directory is removed, watchpack will fire a removed event for each file also
    // (so we don't need to do anything special).
    // However, when a directory is added, it does not fire events for any files *within* the directory,
    // so we need to scan within that directory for new files. It is tricky to use a glob for this,
    // so we'll do something a bit more "dumb" for now
    const absolutePath = path.join(options.workingDir, importPath);
    if (!removed && isDirectory(absolutePath)) {
      await Promise.all(
        specifiers
          // We only receive events for files (incl. directories) that are *within* a specifier,
          // so will match one (or more) specifiers with this simple `startsWith`
          .filter((specifier) => importPath.startsWith(specifier.directory))
          .map(async (specifier) => {
            // If `./path/to/dir` was added, check all files matching `./path/to/dir/**/*.stories.*`
            // (where the last bit depends on `files`).
            const dirGlob = path.join(
              options.workingDir,
              importPath,
              '**',
              // files can be e.g. '**/foo/*/*.js' so we just want the last bit,
              // because the directoru could already be within the files part (e.g. './x/foo/bar')
              path.basename(specifier.files)
            );

            // Dynamically import globby because it is a pure ESM module
            const { globby } = await import('globby');

            // glob only supports forward slashes
            const files = await globby(slash(dirGlob), commonGlobOptions(dirGlob));

            files.forEach((filePath) => {
              const fileImportPath = toImportPath(
                // use posix path separators even on windows
                path.relative(options.workingDir, filePath).replace(/\\/g, '/')
              );

              if (specifier.importPathMatcher.exec(fileImportPath)) {
                onInvalidate(specifier, fileImportPath, removed);
              }
            });
          })
      );
    }
  }

  wp.on('change', async (filePath: Path, mtime: Date, explanation: string) => {
    // When a file is renamed (including being moved out of the watched dir)
    // we see first an event with explanation=rename and no mtime for the old name.
    // then an event with explanation=rename with an mtime for the new name.
    // In theory we could try and track both events together and move the exports
    // but that seems dangerous (what if the contents changed?) and frankly not worth it
    // (at this stage at least)
    const removed = !mtime;
    await onChangeOrRemove(filePath, removed);
  });
  wp.on('remove', async (filePath: Path, explanation: string) => {
    await onChangeOrRemove(filePath, true);
  });

  return () => wp.close();
}
