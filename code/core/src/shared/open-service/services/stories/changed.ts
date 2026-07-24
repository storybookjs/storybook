import type { StoryIndex } from 'storybook/internal/types';

import type {
  Status,
  StatusesByStoryIdAndTypeId,
  StatusValue,
} from '../../../status-store/index.ts';
import { CHANGE_DETECTION_STATUS_TYPE_ID } from '../../../status-store/index.ts';
import type { ChangedStoriesOutput, ChangeStatusValue } from './definition.ts';

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
  unreachableFiles?: string[];
  /** Defaults to `storybook/change-detection`. */
  changeDetectionTypeId?: string;
};

/**
 * Filters change-detection statuses to new/modified/affected, enriches from the story index,
 * sorts by priority then storyId, and returns counts plus unreachable working-tree files.
 */
export function getChangedStories({
  statuses,
  index,
  unreachableFiles = [],
  changeDetectionTypeId = CHANGE_DETECTION_STATUS_TYPE_ID,
}: ChangedStoriesParams): ChangedStoriesOutput {
  const changedFromStatusStore: Status[] = [];
  for (const byType of Object.values(statuses)) {
    const status = byType?.[changeDetectionTypeId];
    if (status?.value && isChangeStatusValue(status.value)) {
      changedFromStatusStore.push(status);
    }
  }

  const stories = changedFromStatusStore.flatMap(({ storyId, value }) => {
    const entry = index.entries[storyId];
    if (!entry || !isChangeStatusValue(value)) {
      return [];
    }
    return [
      {
        storyId,
        statusValue: value,
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

  return {
    stories,
    counts,
    unreachableFiles,
  };
}
