/** Count of stories for each storyId. */
const storyCounts = new Map<string, number>();

/**
 * Increments the count for a storyId and returns the next UID.
 *
 * When a story is bootstrapped, the storyId is used as the element tag. That becomes an issue when
 * a story is rendered multiple times in the same docs page. This function returns a UID that is
 * appended to the storyId to make it unique.
 *
 * @param storyId Id of a story
 * @returns Uid of a story
 */
export const getNextStoryUID = (storyId: string): string => {
  if (!storyCounts.has(storyId)) {
    storyCounts.set(storyId, -1);
  }

  const count = storyCounts.get(storyId) + 1;
  storyCounts.set(storyId, count);
  return `${storyId}-${count}`;
};

/**
 * Clears the storyId counts.
 *
 * Can be useful for testing, where you need predictable increments, without reloading the global
 * state.
 *
 * If onlyStoryId is provided, only that storyId is cleared.
 *
 * @param onlyStoryId Id of a story
 */
export const clearStoryUIDs = (onlyStoryId?: string): void => {
  if (onlyStoryId !== undefined && onlyStoryId !== null) {
    storyCounts.delete(onlyStoryId);
  } else {
    storyCounts.clear();
  }
};
