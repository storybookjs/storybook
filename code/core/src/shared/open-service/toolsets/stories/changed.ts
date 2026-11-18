import type { StoryIndex } from 'storybook/internal/types';

import { resolve as resolvePath } from 'pathe';

import type { StatusesByStoryIdAndTypeId, StatusValue } from '../../../status-store/index.ts';
import { CHANGE_DETECTION_STATUS_TYPE_ID } from '../../../status-store/index.ts';
import type { ChangedFilesOutsideStories } from './changed-files-outside-stories.ts';
import {
  storyFileChangeStatuses,
  type ChangedFileStories,
} from '../../services/module-graph/change-statuses.ts';
import type { ChangedStoriesOutput, ChangeStatusValue } from './definition.ts';
import { buildStoryIdsByFile, type ModuleGraphAccess } from './resolve-component-stories.ts';

const INCLUDED_STATUS_VALUES = new Set<ChangeStatusValue>([
  'status-value:new',
  'status-value:modified',
  'status-value:affected',
]);

function isChangeStatusValue(value: StatusValue): value is ChangeStatusValue {
  return INCLUDED_STATUS_VALUES.has(value as ChangeStatusValue);
}

function statusPriority(statusValue: ChangeStatusValue): number {
  if (statusValue === 'status-value:new') return 0;
  if (statusValue === 'status-value:modified') return 1;
  return 2;
}

export type ChangedStoriesParams = {
  /** Change-detection statuses keyed by storyId → typeId → status. */
  statuses: StatusesByStoryIdAndTypeId;
  index: StoryIndex;
};

export type ChangedStoriesResult = Omit<
  ChangedStoriesOutput,
  keyof ChangedFilesOutsideStories | 'pendingFiles' | 'since'
>;

/**
 * Filters change-detection statuses to new/modified/affected, enriches from the story index,
 * and sorts by priority then storyId.
 */
export function getChangedStories({ statuses, index }: ChangedStoriesParams): ChangedStoriesResult {
  const changed: Array<[storyId: string, statusValue: ChangeStatusValue]> = [];
  for (const byType of Object.values(statuses)) {
    const status = byType?.[CHANGE_DETECTION_STATUS_TYPE_ID];
    if (status?.value && isChangeStatusValue(status.value)) {
      changed.push([status.storyId, status.value]);
    }
  }
  return toChangedStories(changed, index);
}

// Bounds each reverse-index query on a large diff.
const CHUNK_SIZE = 50;

/**
 * The changed stories for the files git reports since a ref, computed for this call: the status
 * store only knows the uncommitted changes. Same statuses as change detection gives, except that
 * `new` comes from git alone: the stories of a story file added since the ref.
 */
export async function getChangedStoriesSince({
  changedFiles,
  repoRoot,
  moduleGraph,
  index,
}: {
  /** Repo-root-relative paths, as git reports them. */
  changedFiles: { changed: Set<string>; new: Set<string> };
  repoRoot: string;
  moduleGraph: ModuleGraphAccess;
  index: StoryIndex;
}): Promise<ChangedStoriesResult> {
  const files = [...new Set([...changedFiles.changed, ...changedFiles.new])];
  const lookups: ChangedFileStories[] = [];
  for (let start = 0; start < files.length; start += CHUNK_SIZE) {
    const chunk = files.slice(start, start + CHUNK_SIZE);
    // One batched lookup per chunk; the result is positional.
    const hits = await moduleGraph.queries.storiesForFiles.loaded({
      files: chunk.map((file) => resolvePath(repoRoot, file)),
    });
    for (const [position, file] of chunk.entries()) {
      lookups.push({ isNew: changedFiles.new.has(file), stories: hits[position] ?? [] });
    }
  }

  const storyIdsByFile = buildStoryIdsByFile(index);
  const changed: Array<[storyId: string, statusValue: ChangeStatusValue]> = [];
  for (const [storyFile, statusValue] of storyFileChangeStatuses(lookups)) {
    for (const storyId of storyIdsByFile.get(storyFile) ?? []) {
      changed.push([storyId, statusValue]);
    }
  }
  return toChangedStories(changed, index);
}

function toChangedStories(
  changed: Array<[storyId: string, statusValue: ChangeStatusValue]>,
  index: StoryIndex
): ChangedStoriesResult {
  const stories = changed.flatMap(([storyId, statusValue]) => {
    const entry = index.entries[storyId];
    // Docs entries carry change statuses too, but a review only takes stories.
    if (!entry || entry.type !== 'story') {
      return [];
    }
    return [
      {
        storyId,
        statusValue,
        title: entry.title,
        name: entry.name,
        importPath: entry.importPath,
      },
    ];
  });

  stories.sort((a, b) => {
    const priorityDelta = statusPriority(a.statusValue) - statusPriority(b.statusValue);
    return priorityDelta !== 0 ? priorityDelta : a.storyId.localeCompare(b.storyId);
  });

  const counts = {
    new: stories.filter((story) => story.statusValue === 'status-value:new').length,
    modified: stories.filter((story) => story.statusValue === 'status-value:modified').length,
    affected: stories.filter((story) => story.statusValue === 'status-value:affected').length,
  };

  return { stories, counts };
}
