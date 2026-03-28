export const getCurrentStoryPreviewInitialized = (
  previewInitialized: boolean,
  refs: Record<string, { previewInitialized?: boolean }>,
  storyData?: { refId?: string }
) => {
  if (storyData?.refId) {
    return Boolean(refs[storyData.refId]?.previewInitialized);
  }

  return previewInitialized;
};
