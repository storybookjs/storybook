import { basename } from 'node:path';

import type { Path } from '@storybook/core/types';

/**
 * Calculate a name to use for a docs entry if not specified. The rule is:
 *
 * 1. If the name of the MDX file is the "same" as the CSF file (e.g. Button.mdx, Button.stories.jsx)
 *    use the default name.
 * 2. Else use the (ext-less) name of the MDX file
 *
 * @param mdxImportPath ImportPath of the MDX file with of={}
 * @param csfImportPath ImportPath of the of CSF file
 */
export function autoName(mdxImportPath: Path, csfImportPath: Path, defaultName: string) {
  const mdxBasename = basename(mdxImportPath);
  const csfBasename = basename(csfImportPath);

  const [mdxFilename] = mdxBasename.split('.');
  const [csfFilename] = csfBasename.split('.');

  if (mdxFilename === csfFilename) {
    return defaultName;
  }

  return mdxFilename;
}
