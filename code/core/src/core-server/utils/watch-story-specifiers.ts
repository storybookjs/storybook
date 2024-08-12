import { type Dirent, lstatSync, readdirSync } from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';

import { commonGlobOptions } from '@storybook/core/common';
import type { NormalizedStoriesSpecifier, Path } from '@storybook/core/types';

import slash from 'slash';
import Watchpack from 'watchpack';

const isDirectory = (directory: Path) => {
  try {
    return lstatSync(directory).isDirectory();
  } catch (err) {
    return false;
  }
};

// Takes an array of absolute paths to directories and synchronously returns
// absolute paths to all existing files and directories nested within those
// directories (including the passed parent directories).
function getNestedFilesAndDirectories(directories: Path[]) {
  const traversedDirectories = new Set<Path>();
  const files = new Set<Path>();
  const traverse = (directory: Path) => {
    if (traversedDirectories.has(directory)) {
      return;
    }
    readdirSync(directory, { withFileTypes: true }).forEach((ent: Dirent) => {
      if (ent.isDirectory()) {
        traverse(join(directory, ent.name));
      } else if (ent.isFile()) {
        files.add(join(directory, ent.name));
      }
    });
    traversedDirectories.add(directory);
  };
  directories.filter(isDirectory).forEach(traverse);
  return { files: Array.from(files), directories: Array.from(traversedDirectories) };
}

export function watchStorySpecifiers(
  specifiers: NormalizedStoriesSpecifier[],
  options: { workingDir: Path },
  onInvalidate: (specifier: NormalizedStoriesSpecifier, path: Path, removed: boolean) => void
) {
  // Watch all nested files and directories up front to avoid this issue:
  // https://github.com/webpack/watchpack/issues/222
  const { files, directories } = getNestedFilesAndDirectories(
    specifiers.map((ns) => resolve(options.workingDir, ns.directory))
  );

  // See https://www.npmjs.com/package/watchpack for full options.
  // If you want less traffic, consider using aggregation with some interval
  const wp = new Watchpack({
    // poll: true, // Slow!!! Enable only in special cases
    followSymlinks: false,
    ignored: ['**/.git', '**/node_modules'],
  });
  wp.watch({ files, directories });

  const toImportPath = (absolutePath: Path) => {
    const relativePath = relative(options.workingDir, absolutePath);
    return slash(relativePath.startsWith('.') ? relativePath : `./${relativePath}`);
  };

  async function onChangeOrRemove(absolutePath: Path, removed: boolean) {
    // Watchpack should return absolute paths, given we passed in absolute paths
    // to watch. Convert to an import path so we can run against the specifiers.
    const importPath = toImportPath(absolutePath);

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
    if (!removed && isDirectory(absolutePath)) {
      await Promise.all(
        specifiers
          // We only receive events for files (incl. directories) that are *within* a specifier,
          // so will match one (or more) specifiers with this simple `startsWith`
          .filter((specifier) => importPath.startsWith(specifier.directory))
          .map(async (specifier) => {
            // If `./path/to/dir` was added, check all files matching `./path/to/dir/**/*.stories.*`
            // (where the last bit depends on `files`).
            const dirGlob = join(
              absolutePath,
              '**',
              // files can be e.g. '**/foo/*/*.js' so we just want the last bit,
              // because the directory could already be within the files part (e.g. './x/foo/bar')
              basename(specifier.files)
            );

            // Dynamically import globby because it is a pure ESM module
            const { globby } = await import('globby');

            // glob only supports forward slashes
            const addedFiles = await globby(slash(dirGlob), commonGlobOptions(dirGlob));

            addedFiles.forEach((filePath: Path) => {
              const fileImportPath = toImportPath(filePath);

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
