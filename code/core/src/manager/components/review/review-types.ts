export type StoryChangeStatus = 'new' | 'modified';

export interface StoryInfo {
  title: string;
  name: string;
  isNewlyAdded?: boolean;
  changeStatus?: StoryChangeStatus;
}

/** Best-effort labels when the Storybook index has not resolved a story yet. */
export const fallbackStoryInfo = (storyId: string): StoryInfo => {
  const separator = storyId.indexOf('--');
  if (separator === -1) {
    return { title: storyId, name: 'Story' };
  }
  return {
    title: storyId.slice(0, separator),
    name: storyId.slice(separator + 2) || 'Story',
  };
};
