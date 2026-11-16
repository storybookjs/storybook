export type StoryChangeStatus =
  | 'status-value:new'
  | 'status-value:modified'
  | 'status-value:affected';

const STRENGTH: Record<StoryChangeStatus, number> = {
  'status-value:new': 2,
  'status-value:modified': 1,
  'status-value:affected': 0,
};

/** One changed file, and the story files that render it with their import-graph depth. */
export type ChangedFileStories = {
  /** Whether the changed file is new, rather than modified. */
  isNew: boolean;
  /** A story file renders itself at depth 0. */
  stories: Array<{ storyFile: string; depth: number }>;
};

/**
 * The change status of every story file that renders a changed file: `new` for a story file that
 * is itself new, `modified` for the story files closest to a changed file, `affected` for those
 * further away. A story file that several changed files reach keeps its strongest status.
 *
 * The one rule behind the sidebar statuses and `stories changed --since`.
 */
export function storyFileChangeStatuses(
  changedFiles: ChangedFileStories[]
): Map<string, StoryChangeStatus> {
  const statuses = new Map<string, StoryChangeStatus>();
  for (const { isNew, stories } of changedFiles) {
    const closest = Math.min(...stories.map(({ depth }) => depth));
    for (const { storyFile, depth } of stories) {
      const status: StoryChangeStatus =
        isNew && depth === 0
          ? 'status-value:new'
          : depth === closest
            ? 'status-value:modified'
            : 'status-value:affected';
      const previous = statuses.get(storyFile);
      if (!previous || STRENGTH[status] > STRENGTH[previous]) {
        statuses.set(storyFile, status);
      }
    }
  }
  return statuses;
}
