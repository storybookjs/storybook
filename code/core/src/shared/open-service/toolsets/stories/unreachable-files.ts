import { logger } from 'storybook/internal/node-logger';

import { resolve as resolvePath } from 'pathe';

import type { StoriesGitAccess } from './definition.ts';
import type { ModuleGraphAccess } from './resolve-component-stories.ts';

const SOURCE_EXT_RE = /\.(?:tsx?|jsx?|mjs|cjs)$/i;

/**
 * Module-graph query batch size. Bounds the per-call file list so a large working tree doesn't
 * issue one oversized reverse-index query; we early-exit between chunks once `maxFiles` is reached.
 */
const CHUNK_SIZE = 50;

/** Cap on files reported inline, so a large working tree can't dominate the response. */
const DEFAULT_MAX_FILES = 10;

/**
 * Lists working-tree files that no story reaches through the import graph.
 *
 * This is the "your edit isn't in the graph; you'll need to grep" case — typical for theme tokens,
 * decorator config, and other files consumed through Storybook's preview runtime rather than a
 * story-file import. Paths stay repo-root-relative because they are shown to an agent that will
 * grep for them.
 */
export async function detectUnreachableFiles({
  git,
  moduleGraph,
  maxFiles = DEFAULT_MAX_FILES,
}: {
  git: StoriesGitAccess;
  moduleGraph: ModuleGraphAccess;
  maxFiles?: number;
}): Promise<string[]> {
  const status = await moduleGraph.queries.status.loaded(undefined);
  if (status.value !== 'ready') {
    return [];
  }

  let changedFiles: Awaited<ReturnType<StoriesGitAccess['getChangedFiles']>>;
  let repoRoot: string;
  try {
    [changedFiles, repoRoot] = await Promise.all([git.getChangedFiles(), git.getRepoRoot()]);
  } catch (error) {
    // Not a git repository, or git itself is unusable. Change detection legitimately answers
    // "no changes detected" here — the pre-toolset tool degraded the same way — so the failure
    // must not turn the whole tool into an error for the agent.
    logger.debug(`Unreachable-file detection skipped, git is unavailable: ${error}`);
    return [];
  }
  const relativeFiles = [...new Set([...changedFiles.changed, ...changedFiles.new])].filter(
    (file) => SOURCE_EXT_RE.test(file)
  );

  const unreachable: string[] = [];
  for (
    let start = 0;
    start < relativeFiles.length && unreachable.length < maxFiles;
    start += CHUNK_SIZE
  ) {
    const chunk = relativeFiles.slice(start, start + CHUNK_SIZE);
    // One batched lookup per chunk; the result is positional.
    const hits = await moduleGraph.queries.storiesForFiles.loaded({
      files: chunk.map((file) => resolvePath(repoRoot, file)),
    });
    for (const [position, file] of chunk.entries()) {
      if (unreachable.length >= maxFiles) {
        break;
      }
      if ((hits[position]?.length ?? 0) === 0) {
        unreachable.push(file);
      }
    }
  }

  return unreachable;
}
