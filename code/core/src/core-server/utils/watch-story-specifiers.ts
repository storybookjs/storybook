import { type Dirent, lstatSync, readdirSync } from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';

import { commonGlobOptions } from 'storybook/internal/common';
import type { NormalizedStoriesSpecifier, Path } from 'storybook/internal/types';

// eslint-disable-next-line depend/ban-dependencies
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

/**
 * Optional hint passed to {@link watchStorySpecifiers}'s `onInvalidate` callback
 * when a removal event appears to be the source side of a file rename.
 *
 * The watcher only provides a hint when a single rename-explanation removal
 * and a single rename-explanation addition arrive in the same batch window.
 * Ambiguous batches (e.g. folder renames with multiple files) produce no hint
 * here; disambiguation is deferred to the orchestrator via export-name
 * fingerprint matching.
 */
export type RenameHint = { pairedWith: Path };

export function watchStorySpecifiers(
  specifiers: NormalizedStoriesSpecifier[],
  options: { workingDir: Path },
  onInvalidate: (path: Path, removed: boolean, renameHint?: RenameHint) => void
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

  async function onChangeOrRemove(absolutePath: Path, removed: boolean, renameHint?: RenameHint) {
    // Watchpack should return absolute paths, given we passed in absolute paths
    // to watch. Convert to an import path so we can run against the specifiers.
    const importPath = toImportPath(absolutePath);

    const matchingSpecifier = specifiers.find((ns) => ns.importPathMatcher.exec(importPath));
    if (matchingSpecifier) {
      if (renameHint) {
        // Convert the paired absolute path to its import-path form before surfacing.
        onInvalidate(importPath, removed, { pairedWith: toImportPath(renameHint.pairedWith) });
      } else {
        onInvalidate(importPath, removed);
      }
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
            // eslint-disable-next-line depend/ban-dependencies
            const { globby } = await import('globby');

            // glob only supports forward slashes
            const addedFiles = await globby(slash(dirGlob), commonGlobOptions(dirGlob));

            addedFiles.forEach((filePath: Path) => {
              const fileImportPath = toImportPath(filePath);

              if (specifier.importPathMatcher.exec(fileImportPath)) {
                onInvalidate(fileImportPath, removed);
              }
            });
          })
      );
    }
  }

  // Batch rapid file events to avoid redundant processing.
  // Watchpack fires multiple events for the same file in rapid succession.
  // We collect events for 100ms, then process unique paths only.
  const pendingEvents = new Map<Path, { removed: boolean; explanation: string | undefined }>();
  let batchTimeout: ReturnType<typeof setTimeout> | undefined;

  function queueEvent(absolutePath: Path, removed: boolean, explanation: string | undefined) {
    // Store/overwrite the event for this path (last event type wins)
    pendingEvents.set(absolutePath, { removed, explanation });

    // Reset the timer on each new event to batch them together
    if (batchTimeout) {
      clearTimeout(batchTimeout);
    }
    batchTimeout = setTimeout(async () => {
      batchTimeout = undefined;
      const events = new Map(pendingEvents);
      pendingEvents.clear();

      // When a file is renamed, Watchpack fires an event with
      // `explanation=rename` and no mtime for the old name, followed shortly
      // after by a second event with `explanation=rename` with an mtime for
      // the new name. If a batch contains exactly one such removal and one
      // such addition, we can confidently pair them here and surface a rename
      // hint; any other shape is considered ambiguous and defers pairing to
      // the orchestrator (which uses export-name fingerprint matching).
      const renameRemovals: Path[] = [];
      const renameAdditions: Path[] = [];
      for (const [path, { removed: isRemoved, explanation }] of events) {
        if (explanation !== 'rename') {
          continue;
        }
        if (isRemoved) {
          renameRemovals.push(path);
        } else {
          renameAdditions.push(path);
        }
      }
      const pair =
        renameRemovals.length === 1 && renameAdditions.length === 1
          ? { from: renameRemovals[0], to: renameAdditions[0] }
          : undefined;

      await Promise.all(
        Array.from(events.entries()).map(([path, { removed: isRemoved, explanation }]) => {
          let renameHint: RenameHint | undefined;
          if (isRemoved && explanation === 'rename' && pair && path === pair.from) {
            renameHint = { pairedWith: pair.to };
          }
          return onChangeOrRemove(path, isRemoved, renameHint);
        })
      );
    }, 100);
  }

  wp.on('change', (filePath: Path, mtime: Date, explanation: string) => {
    const removed = !mtime;
    queueEvent(filePath, removed, explanation);
  });
  wp.on('remove', (filePath: Path) => {
    queueEvent(filePath, true, undefined);
  });

  return () => wp.close();
}
