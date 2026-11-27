import { realpathSync } from 'node:fs';

import { dirname, isAbsolute, join, relative } from 'pathe';

/**
 * The path of a component's file, written like the story file's index `importPath` it was reached
 * from.
 *
 * Module resolvers follow symlinks, so the component path is taken relative to the story file's
 * real folder and joined to the folder the index wrote. A symlinked story folder, as in linked
 * sandboxes, then gives the same path as a plain one. A component on another drive has no relative
 * path, so its absolute path is returned.
 */
export function componentPathFromStory(
  storyImportPath: string,
  storyFilePath: string,
  componentPath: string
): string {
  const fromStory = relative(dirname(realpathSync(storyFilePath)), componentPath);
  if (isAbsolute(fromStory)) {
    return fromStory;
  }
  const path = join(dirname(storyImportPath), fromStory);
  return isAbsolute(path) || path.startsWith('../') ? path : `./${path}`;
}
