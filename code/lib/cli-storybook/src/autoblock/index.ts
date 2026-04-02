import type {
  AutoblockOptions,
  AutoblockerResult,
  Blocker,
  BlockerCheckResult,
  BlockerModule,
} from './types.ts';

const blockers: () => BlockerModule<any>[] = () => [
  // add/remove blockers here
  import('./block-dependencies-versions.ts'),
  import('./block-node-version.ts'),
  import('./block-webpack5-frameworks.ts'),
  import('./block-major-version.ts'),
  import('./block-experimental-addon-test.ts'),
];

/**
 * Runs autoblockers for a given project
 *
 * @param options - The options for the autoblockers.
 * @param list - The list of autoblockers to run.
 * @returns The results of the autoblockers.
 */
export const autoblock = async <R = unknown>(
  options: AutoblockOptions,
  list: BlockerModule<unknown>[] = blockers()
): Promise<AutoblockerResult<R>[] | null> => {
  if (list.length === 0) {
    return null;
  }

  return await Promise.all(
    list.map(async (i) => {
      const blocker = (await i).blocker as Blocker<R>;
      const result = (await blocker.check(options)) as BlockerCheckResult<R>;
      return { result, blocker };
    })
  );
};
