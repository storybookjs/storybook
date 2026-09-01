// Which files' JSX the census counts, from include and exclude glob lists.
//
// Separate from package-pattern.ts because the two match different things: that
// one matches bare import specifiers against package patterns, this one matches
// file paths and so wants real glob semantics (globstars, braces, extglobs),
// which is picomatch's job rather than ours.
//
// A filtered-out file is still parsed and still resolves imports; it only
// leaves the count. That is the whole point: a monorepo vendoring its own
// design system wants `core/src/components/**` excluded from the app's UI
// total while every relative import into it keeps resolving.
import path from 'node:path';

import picomatch from 'picomatch';

import type { IsCountedFile } from './types.ts';

// The census keys files by workspace-relative path, and a leading dot is
// nothing special there: `.storybook/**` should mean what it says rather than
// silently matching nothing.
const MATCH_OPTIONS = { dot: true } as const;

/** Converts absolute path to project-root-relative. */
function toProjectRelative(glob: string, root: string): string {
  if (!path.isAbsolute(glob)) {
    return glob;
  }

  const relative = path.relative(root, glob);
  if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(
      `ds-coverage: filter '${glob}' is outside the analyzed tree (${root}), so it can never match. ` +
        'Pass a path inside it, or a pattern relative to it.'
    );
  }
  return relative.split(path.sep).join('/');
}

/**
 * A predicate over workspace-relative paths, matched by picomatch.
 *
 * - a file counts when it matches at least one include glob (every file counts
 *   when the include list is empty)
 * - a file matching any exclude glob is out regardless
 *
 * Globs are taken verbatim, so a leading `!(...)` extglob is an extglob.
 */
export function createPathFilter(
  include: string[],
  exclude: string[],
  projectDir: string
): IsCountedFile {
  const root = path.resolve(projectDir);
  const compile = (glob: string) => picomatch(toProjectRelative(glob, root), MATCH_OPTIONS);
  const included = include.map(compile);
  const excluded = exclude.map(compile);

  return (candidate) => {
    if (excluded.some((matches) => matches(candidate))) {
      return false;
    }

    return included.length === 0 || included.some((matches) => matches(candidate));
  };
}
