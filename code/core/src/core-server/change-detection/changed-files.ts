import { resolve } from 'pathe';

import { ChangeDetectionFailureError } from './errors.ts';
import { GitDiffProvider } from './GitDiffProvider.ts';

/**
 * Absolute paths of the files Vitest's `--changed` reads: the uncommitted changes (staged, unstaged,
 * untracked and deleted), plus, with `since`, everything committed on this branch since it forked
 * from that ref. Read through the git reader behind change detection, with Vitest's commands.
 *
 * @throws ChangeDetectionUnavailableError Outside a git repository, or without git.
 * @throws ChangeDetectionFailureError When git fails, for example on an unknown ref.
 */
export async function findChangedFiles({
  cwd = process.cwd(),
  since,
}: {
  cwd?: string;
  since?: string;
} = {}): Promise<string[]> {
  const git = new GitDiffProvider(cwd);
  const repoRoot = await git.getRepoRoot();
  try {
    const files = await git.getChangedFilesForTests(since);
    return files.map((file) => resolve(repoRoot, file));
  } catch (error) {
    // Git's own message for this runs to several lines of usage advice.
    if (since && error instanceof Error && /unknown revision|bad revision/.test(error.message)) {
      throw new ChangeDetectionFailureError(`\`${since}\` is not a known git ref.`, {
        cause: error,
      });
    }
    throw error;
  }
}
