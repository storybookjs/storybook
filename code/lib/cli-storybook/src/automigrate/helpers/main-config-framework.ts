import { dedent } from 'ts-dedent';

import type { FixFiles } from '../fix-files.ts';

/**
 * Throw unless the main config names `framework` (before or after the migration), before a fix
 * swaps that framework's dependencies: a framework inherited from a shared config is out of reach.
 */
export const assertMainConfigNamesFramework = async (
  files: Pick<FixFiles, 'read'>,
  mainConfigPath: string,
  framework: string | RegExp,
  { from, to }: { from: string; to: string }
) => {
  const main = await files.read(mainConfigPath);
  if (typeof framework === 'string' ? main.includes(framework) : main.search(framework) !== -1) {
    return;
  }
  throw new Error(dedent`
    The \`framework\` field could not be rewritten in ${mainConfigPath}.
    That file names no \`${from}\`, so it most likely inherits the framework from a shared config.
    Point \`framework\` at \`${to}\` where it is declared, then run this migration again.
  `);
};
