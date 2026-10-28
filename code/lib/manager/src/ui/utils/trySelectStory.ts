export async function trySelectStory(
  selectStory: (id?: string) => void,
  storyId?: string,
  attempt = 1
): Promise<void> {
  if (attempt > 10) {
    throw new Error('We could not select the new story. Please try again.');
  }

  try {
    selectStory(storyId);
  } catch {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return trySelectStory(selectStory, storyId, attempt + 1);
  }
}
