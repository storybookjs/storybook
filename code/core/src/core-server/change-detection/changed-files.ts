import { resolve } from 'pathe';

import { ChangeDetectionFailureError } from './errors.ts';
import { GitDiffProvider } from './GitDiffProvider.ts';

async function getFilesSince(git: GitDiffProvider, since: string): Promise<Set<string>> {
  try {
    return await git.getFilesSince(since);
  } catch (error) {
    // Git's own message for this runs to several lines of usage advice.
    if (error instanceof Error && /unknown revision|bad revision/.test(error.message)) {
      throw new ChangeDetectionFailureError(`\`${since}\` is not a known git ref.`, {
        cause: error,
      });
    }
    throw error;
  }
}

/**
 * Absolute paths of the files Vitest's `--changed` would read: the uncommitted changes (staged,
 * unstaged and untracked), plus, with `since`, everything committed on this branch since it forked
 * from that ref. Deleted files count as changed, as in Vitest, though they select no story. The same
 * git reader as change detection, which reads the same uncommitted changes but leaves deletions out.
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
  // A ref is passed to git as an argument; one that starts with `-` would be read as an option.
  if (since?.startsWith('-')) {
    throw new ChangeDetectionFailureError(`\`${since}\` is not a git ref.`);
  }
  const git = new GitDiffProvider(cwd);
  const repoRoot = await git.getRepoRoot();
  const [uncommitted, deleted, committed] = await Promise.all([
    git.getChangedFiles(),
    git.getDeletedFiles(),
    since ? getFilesSince(git, since) : new Set<string>(),
  ]);
  const files = new Set([...committed, ...uncommitted.changed, ...uncommitted.new, ...deleted]);
  return [...files].map((file) => resolve(repoRoot, file));
}
