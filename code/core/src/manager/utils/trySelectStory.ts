export async function trySelectStory(
  selectStory: (id?: string) => Promise<void> | void,
  storyId?: string,
  attempt = 1
): Promise<void> {
  if (attempt > 10) {
    throw new Error('We could not select the new story. Please try again.');
  }

  try {
    await selectStory(storyId);
  } catch {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return trySelectStory(selectStory, storyId, attempt + 1);
  }
}
