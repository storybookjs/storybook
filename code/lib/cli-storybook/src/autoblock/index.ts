import type {
  AutoblockOptions,
  AutoblockerResult,
  Blocker,
  BlockerCheckResult,
  BlockerModule,
} from './types';

const blockers: () => BlockerModule<any>[] = () => [
  // add/remove blockers here
  import('./block-dependencies-versions'),
  import('./block-node-version'),
  import('./block-webpack5-frameworks'),
  import('./block-major-version'),
  import('./block-experimental-addon-test'),
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
