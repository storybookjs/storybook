export type TagsFilter = {
  include: string[];
  exclude: string[];
  skip: string[];
};

export const matchesTagsFilter = (storyTags: string[], tagsFilter: TagsFilter) => {
  if (tagsFilter.include.length && !tagsFilter.include.some((tag) => storyTags.includes(tag))) {
    return false;
  }
  if (tagsFilter.exclude.some((tag) => storyTags.includes(tag))) {
    return false;
  }
  // Skipped tests are intentionally included here
  return true;
};
