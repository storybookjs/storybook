/**
 * Whole-scan staleness for Compodoc's `documentation.json`.
 *
 * Staleness cannot be decided per component: a component's payload depends on base classes, enums
 * and type aliases in other files, and on which same-named components exist elsewhere in the scan.
 * So the unit is the whole scan.
 *
 * The signal is mtime, not content. Two Compodoc runs over an unchanged tree are not byte-identical
 * - ordering inside `miscellaneous.typealiases` and `variables` drifts - so a content hash would
 * report a change that is not one.
 */
import { readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/**
 * The file set Compodoc itself scans, mirrored from its `INCLUDE_PATTERNS` / `EXCLUDE_PATTERNS`.
 *
 * Getting this wrong is expensive in both directions: counting a file Compodoc ignores means a
 * whole-project rescan on every cold start after an ordinary `ng build` or test edit, and missing one
 * it reads means a component silently never appears.
 */
const SKIPPED_DIRECTORY_NAMES = new Set(['node_modules', '.git']);
const SOURCE_EXTENSIONS = ['.ts', '.tsx'];
const IGNORED_SUFFIXES = ['.d.ts', '.spec.ts'];

const isScannedSource = (fileName: string): boolean =>
  SOURCE_EXTENSIONS.some((extension) => fileName.endsWith(extension)) &&
  !IGNORED_SUFFIXES.some((suffix) => fileName.endsWith(suffix));

const statOrUndefined = (path: string) => {
  try {
    return statSync(path);
  } catch {
    return undefined;
  }
};

/**
 * The directory Compodoc sweeps: the one holding the tsconfig it was pointed at.
 *
 * Compodoc globs from `dirname(tsconfig)` and narrows that with the tsconfig's own `include`,
 * `exclude` and `files`. This check deliberately does not reproduce that narrowing - it only needs
 * to know whether anything Compodoc *might* have read has changed, and over-approximating within the
 * same directory can at worst regenerate once too often, whereas guessing too small a set would
 * serve stale metadata forever.
 */
export const findCompodocScanRoot = (tsconfigPath: string): string =>
  dirname(resolve(tsconfigPath));

/**
 * Newest mtime among the files Compodoc would scan under `scanRoot`, or `undefined` when there are
 * none.
 *
 * Symlinked directories are not followed, so a source tree reachable only through one is invisible
 * here. `.html` templates and `.scss` styles are out too: they change `documentation.json`, but not
 * the `argTypes`, `description` or `jsDocTags` this framework derives from it.
 */
export const newestSourceMtimeMs = (
  scanRoot: string,
  skippedDirectories: string[] = []
): number | undefined => {
  const skipped = new Set(skippedDirectories.map((directory) => resolve(directory)));
  let newest: number | undefined;

  const walk = (directory: string) => {
    let entries;
    try {
      entries = readdirSync(directory, { withFileTypes: true });
    } catch {
      // An unreadable directory contributes nothing; it is not evidence of a change.
      return;
    }

    for (const entry of entries) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!SKIPPED_DIRECTORY_NAMES.has(entry.name) && !skipped.has(path)) {
          walk(path);
        }
      } else if (entry.isFile() && isScannedSource(entry.name)) {
        const stats = statOrUndefined(path);
        if (stats && (newest === undefined || stats.mtimeMs > newest)) {
          newest = stats.mtimeMs;
        }
      }
    }
  };

  walk(resolve(scanRoot));
  return newest;
};

/**
 * Whether `documentation.json` can be served as it stands.
 *
 * A zero-length file counts as stale: Compodoc's own write is not atomic, so that is what a file
 * caught mid-write looks like.
 */
export const isDocumentationFresh = (
  documentationJsonPath: string,
  scanRoot: string,
  skippedDirectories: string[] = []
): boolean => {
  const stats = statOrUndefined(documentationJsonPath);
  if (!stats?.isFile() || stats.size === 0) {
    return false;
  }

  const newest = newestSourceMtimeMs(scanRoot, skippedDirectories);
  // Nothing to be stale against - a tree Compodoc could not have scanned either - so whatever is on
  // disk is as good as a rerun would produce.
  // A source sharing the file's exact timestamp counts as stale: filesystems with coarse timestamps
  // report an edit made moments later as the same instant, and regenerating once too often is much
  // cheaper than serving metadata that never refreshes.
  return newest === undefined || stats.mtimeMs > newest;
};
